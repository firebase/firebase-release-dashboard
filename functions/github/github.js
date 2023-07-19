const {log, error} = require("firebase-functions/logger");
const {parseGradlePropertiesForVersion} = require("../utils/utils.js");
const crypto = require("crypto");

const OWNER = "firebase";
const REPO = "firebase-android-sdk";
const X_GITHUB_API_VERSION = "2022-11-28";
const REPO_URL = `https://github.com/${OWNER}/${REPO}`;

/**
 * Fetches and returns the content of a specific file from a GitHub repository.
 *
 * @param {Octokit} octokit The authenticated Octokit instance.
 * @param {string} ref The git reference (typically a branch or tag).
 * @param {string} path The path to the file within the repository.
 * @return {Promise<string>} The file's content as a string.
 */
async function getRepositoryContent(octokit, ref, path) {
  log("fetching repository content", {ref: ref, path: path});
  try {
    // Fetch the file from the GitHub repository
    const response = await octokit.request(
        "GET /repos/{owner}/{repo}/contents/{path}", {
          owner: OWNER,
          repo: REPO,
          path: path,
          ref: ref,
          headers: {
            "X-GitHub-Api-Version": X_GITHUB_API_VERSION,
          },
        });

    // Decode the file content (which is base64 encoded by GitHub)
    const content = Buffer.from(response.data.content, "base64").toString();
    return content;
  } catch (err) {
    error(
        `Error fetching ${path} on ${ref} from GitHub:`,
        {error: err.message},
    );
    throw err;
  }
}

/**
 * Fetches and returns a list of check runs for a specific git reference.
 *
 * @param {Octokit} octokit The authenticated Octokit instance.
 * @param {String} ref The git reference (typically a branch or tag).
 * @return {Promise<Array>} An array of check run objects.
 */
async function listCheckRuns(octokit, ref) {
  try {
    // Fetch the list of check runs for the git reference
    const checkRuns = await octokit.paginate(
        "GET /repos/{owner}/{repo}/commits/{ref}/check-runs", {
          owner: OWNER,
          repo: REPO,
          ref: ref,
          headers: {
            "X-GitHub-Api-Version": X_GITHUB_API_VERSION,
          },
          per_page: 100,
        });

    return checkRuns;
  } catch (err) {
    error(
        `Error fetching check suites on ${ref} from GitHub:`,
        {error: err.message},
    );
    throw err;
  }
}

/**
 * Fetches and parses release configuration data from a GitHub repository.
 *
 * The release configuration is expected to be in the following format:
 * {
 *   "name": string,
 *   "libraries": Array<string>
 * }
 *
 * For an example, see:
 * https://github.com/firebase/firebase-android-sdk/blob/releases/M134.release/release.json
 *
 * @param {Octokit} octokit The authenticated Octokit client.
 * @param {Object} releaseData The release data containing the branch name.
 * @return {Promise<Object>} A promise that resolves to the parsed configuration
 * data.
 */
async function getReleaseConfig(octokit, releaseData) {
  const releaseConfigJSON = await getRepositoryContent(
      octokit, releaseData.releaseBranchName, "release.json",
  );
  const releaseConfig = JSON.parse(releaseConfigJSON);
  return releaseConfig;
}

/**
 * Fetches and parses release report data from a GitHub repository.
 *
 * The release report is expected to be in the following format:
 * {
 *   "changesByLibraryName": {
 *     libraryName: Array<Object>
 *    ],
 *    "changedLibrariesWithNoChangeLog": Array<string>,
 * }
 *
 * For an example, see:
 * https://github.com/firebase/firebase-android-sdk/blob/releases/M134.release/release_report.json
 *
 * @param {Octokit} octokit The authenticated Octokit client.
 * @param {Object} releaseData The release data containing the branch name.
 * @return {Promise<boolean>} A promise that resolves to the parsed report
 * data.
 */
async function getReleaseReport(octokit, releaseData) {
  const releaseReportJSON = await getRepositoryContent(
      octokit, releaseData.releaseBranchName, "release_report.json",
  );
  const releaseReport = JSON.parse(releaseReportJSON);
  return releaseReport;
}

/**
 * Fetches and returns metadata for each library in the release configuration.
 * The metadata includes the updated version, whether the library is opted in
 * to the release, and whether the library is lockstep. A library is lockstep
 * if it is part of the release but has no changes. A library is opted in if
 * it was not originally part of the release report, but has been manually opted
 * in by being added to the release configuration.
 *
 * @param {Octokit} octokit - The authenticated Octokit client.
 * @param {string} releaseBranchName - The release branch name
 * @param {Object} releaseReport - The release report
 * @param {Object} releaseConfig - The release configuration with the processed
 * library names.
 * @return {Promise<Object>} A promise that resolves to an object mapping
 * library names to metadata.
 */
async function getLibraryMetadata(
    octokit,
    releaseBranchName,
    releaseReport,
    releaseConfig,
) {
  const libraryMetadata = {};
  const libraryVersions = await getLibraryVersions(
      octokit,
      releaseBranchName,
      releaseConfig,
  );
  log("Fetched library versions", {libraryVersions: libraryVersions});

  for (const library in libraryVersions) {
    if (Object.prototype.hasOwnProperty.call(libraryVersions, library)) {
      libraryMetadata[library] = {
        "updatedVersion": libraryVersions[library],
        "optedIn": !releaseReport.changesByLibraryName[library],
        "libraryGroupRelease": !releaseReport.changesByLibraryName[library] ||
        releaseReport.changesByLibraryName[library].length === 0,
      };
    }
  }

  log("Library metadata", {libraryMetadata: libraryMetadata});
  return libraryMetadata;
}

/**
 * Extracts the version for each library in the release configuration from the
 * repository and stores them in an object.
 *
 * @param {Octokit} octokit The authenticated Octokit client.
 * @param {Object} releaseBranchName The release branch name.
 * @param {Object} releaseConfig The release configuration with the processed
 * library names.
 * @return {Promise<Object>} A promise that resolves to an object mapping
 * library names to versions.
 */
async function getLibraryVersions(octokit, releaseBranchName, releaseConfig) {
  const libraryVersions = {};

  // Fetch and parse all library versions from grade properties files
  // in the release branch and store them in an object.
  // Perform all requests in parallel.
  const promises = releaseConfig.libraries.map(async (library) => {
    const gradleDir = library.endsWith("/ktx") ?
        library.replace("/ktx", "") : library;

    const gradleProperties = await getRepositoryContent(
        octokit, releaseBranchName,
        `${gradleDir}/gradle.properties`,
    );
    const version = parseGradlePropertiesForVersion(gradleProperties);
    libraryVersions[library] = version;
  });

  await Promise.all(promises);

  return libraryVersions;
}

/**
 * Checks whether a given release branch exists in the repository.
 *
 * @param {Octokit} octokit The authenticated Octokit client.
 * @param {string} releaseBranchName The name of the release branch to check.
 * @return {Promise<boolean>} A promise that resolves to true if the branch
 * exists, false otherwise.
 */
async function checkReleaseBranchExists(octokit, releaseBranchName) {
  try {
    await octokit.request(
        "GET /repos/{owner}/{repo}/branches/{branch}", {
          owner: OWNER,
          repo: REPO,
          branch: releaseBranchName,
          headers: {
            "X-GitHub-Api-Version": X_GITHUB_API_VERSION,
          },
        });
  } catch (err) {
    error("error occured while checking if release branch exists",
        {error: err.message});
    return false;
  }

  return true;
}

/**
 * Retrieve the Build Release Artifact workflow run on the release branch.
 *
 * @param {Octokit} octokit
 * @param {string} releaseBranchName
 * @throws {Error} If there is no Build Release Artifacts workflow run on the
 * release branch.
 * @return {Promise<Object>} The build artifact workflow run.
 */
async function getBuildArtifactsWorkflow(octokit, releaseBranchName) {
  // Fetch the Build Release Artifact workflow run on the release branch
  try {
    const res = await octokit.request(
        "GET /repos/{owner}/{repo}/actions/runs", {
          owner: OWNER,
          repo: REPO,
          branch: releaseBranchName,
          headers: {
            "X-GitHub-Api-Version": X_GITHUB_API_VERSION,
          },
        });

    for (const workflow of res.data.workflow_runs) {
      if (workflow.name === "Build Release Artifacts") {
        return workflow;
      }
    }

    throw new Error(`No Build Release Artifacts workflow found on 
    ${releaseBranchName}`);
  } catch (err) {
    error("error while fetching build artifact status", {error: err.message});
    throw err;
  }
}

/**
  * Verifies the signature of a request.
  *
  * @param {Object} req The request to verify.
  * @param {string} secret The secret to use to verify the signature.
  * @return {boolean} True if the signature is valid, false otherwise.
  */
function verifySignature(req, secret) {
  const signature = crypto
      .createHmac("sha256", secret)
      .update(JSON.stringify(req.body))
      .digest("hex");

  return `sha256=${signature}` === req.headers["x-hub-signature-256"];
}

module.exports = {
  listCheckRuns,
  getReleaseConfig,
  getReleaseReport,
  getLibraryMetadata,
  checkReleaseBranchExists,
  getBuildArtifactsWorkflow,
  verifySignature,
  REPO_URL,
};
