const {log} = require("firebase-functions/logger");
const {parseGradlePropertiesForVersion} = require("../utils/utils.js");
const crypto = require("crypto");
const {getUniqueValues} = require("../utils/utils.js");

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
 * @throws {Error} If the request fails.
 * @return {Promise<string>} The file's content as a string.
 */
async function getRepositoryContent(octokit, ref, path) {
  log("fetching repository content", {ref: ref, path: path});
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
}

/**
 * Fetches and returns a list of check runs for a specific git reference.
 *
 * @param {Octokit} octokit The authenticated Octokit instance.
 * @param {String} ref The git reference (typically a branch or tag).
 * @throws {Error} If the request fails.
 * @return {Promise<Array>} An array of check run objects.
 */
async function listCheckRuns(octokit, ref) {
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
 * Fetches and returns metadata for each library in the release according to
 * the list of libraries in the release, and the changes that we know about.
 * Metadata includes whether the library is part of a group release, whether
 * the library is opted in to the release, and the updated version of the
 * library.
 *
 * A library is part of a group release if it has zero changes, but is included
 * in the release.
 *
 * A library is opted in to a release if it is not included in our changes at
 * all, but was included in the release. Similarly, a library is opted out of
 * a release if it is included in our changes, but it is not included in the
 * list of releases.
 *
 * Note: These inferences for metadata are made with the assumption that
 * the changes for a release are only generated once at the initial cut of
 * the release, and that libraries that are part of a group release are
 * included in those changes, but are just empty. We also assume that
 * the list of changes is what represents the libraries that are truly
 * releasing, whether they are included in the changes or not.
 *
 * @param {Octokit} octokit - The authenticated Octokit client.
 * @param {string} releaseBranchName - The release branch name
 * @param {Array<string>} libraryNames - The release report
 * @param {Map<string, Array<Object>>} libraryChanges - A map of library names
 * to a list of changes.
 * @return {Promise<Object>} A promise that resolves to an object mapping
 * library names to metadata.
 */
async function getLibraryMetadata(
    octokit,
    releaseBranchName,
    libraryNames,
    libraryChanges,
) {
  const libraryMetadata = {};
  const allLibraryNames = getUniqueValues(
      [...libraryNames, ...Object.keys(libraryChanges)],
  );
  const libraryVersions = await getLibraryVersions(
      octokit,
      releaseBranchName,
      allLibraryNames,
  );

  for (const library in libraryVersions) {
    if (Object.prototype.hasOwnProperty.call(libraryVersions, library)) {
      const libraryIsReleasing = libraryNames.includes(library);
      const libraryIsInChanges = Object.keys(libraryChanges).includes(library);
      const libraryHasAtLeastOneChange = libraryIsInChanges &&
        libraryChanges[library].length > 0;
      libraryMetadata[library] = {
        "updatedVersion": libraryVersions[library],
        "optedIn": libraryIsReleasing && !libraryIsInChanges,
        "optedOut": !libraryIsReleasing && libraryIsInChanges,
        "libraryGroupRelease": libraryIsInChanges &&
          !libraryHasAtLeastOneChange,
      };
    }
  }

  return libraryMetadata;
}

/**
 * Extracts the version for each library in the release from the
 * repository and stores them in an object.
 *
 * @param {Octokit} octokit The authenticated Octokit client.
 * @param {Object} releaseBranchName The release branch name.
 * @param {Object} libraryNames The names of the libraries in the release.
 * @return {Promise<Object>} A promise that resolves to an object mapping
 * library names to versions.
 */
async function getLibraryVersions(octokit, releaseBranchName, libraryNames) {
  const libraryVersions = {};

  // Fetch and parse all library versions from grade properties files
  // in the release branch and store them in an object.
  // Perform all requests in parallel.
  const promises = libraryNames.map(async (library) => {
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
 * @throws {Error} If the request fails. If the branch does not exist, the
 * request will fail with a 404 error.
 * @return {Promise<boolean>} A promise that resolves to true if the branch
 * exists, false otherwise.
 */
async function getReleaseBranch(octokit, releaseBranchName) {
  await octokit.request(
      "GET /repos/{owner}/{repo}/branches/{branch}", {
        owner: OWNER,
        repo: REPO,
        branch: releaseBranchName,
        headers: {
          "X-GitHub-Api-Version": X_GITHUB_API_VERSION,
        },
      });

  // If the request succeeds, the branch exists
  return true;
}

/**
 * Retrieve the Build Release Artifact workflow run on the release branch.
 *
 * @param {Octokit} octokit
 * @param {string} releaseBranchName
 * @throws {Error} If the request fails.
 * @throws {Error} If no Build Release Artifacts workflow is found on the
 * release branch.
 * @return {Promise<Object>} The build artifact workflow run.
 */
async function getBuildArtifactsWorkflow(octokit, releaseBranchName) {
  // Fetch the Build Release Artifact workflow run on the release branch
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
}

/**
  * Verifies the signature of a request.
  *
  * We want to limit requests to those coming from GitHub. To do this, we
  * verify the signature of the request using the secret set in the webhook.
  * The signature is passed in the `x-hub-signature` header as a SHA256 HMAC
  * hex digest. The signature is generated using the request body as the
  * message and the secret as the key. The signature in the header is prefixed
  * with `sha256=`. We verify the signature by generating our own signature
  * using the secret and the request body and comparing it to the signature
  * in the header. If they match, the request is verified.
  *
  * See https://docs.github.com/en/webhooks-and-events/webhooks/securing-your-webhooks
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
  getReleaseBranch,
  getBuildArtifactsWorkflow,
  verifySignature,
  REPO_URL,
};
