const admin = require("firebase-admin");
const {Octokit} = require("@octokit/rest");
const {defineSecret} = require("firebase-functions/params");
const GITHUB_TOKEN = defineSecret("GITHUB_TOKEN");

const {
  log,
  warn,
  error,
} = require("firebase-functions/logger");
const {
  getPreviousReleaseData,
  deleteUpcomingReleases,
  addReleases,
  getReleaseID,
  updateRelease,
  updateReleaseState,
  updateChecksForRelease,
  updateChangesForRelease,
  updateLibrariesForRelease,
  getReleaseData,
} = require("../database/database.js");
const {
  checkReleaseBranchExists,
  getReleaseConfig,
  getReleaseReport,
  getBuildArtifactsWorkflow,
  listCheckRuns,
  getLibraryVersions,
} = require("../github/github.js");
const {validateNewReleases} = require("../validation/validation.js");
const {
  convertDatesToTimestamps,
  processLibraryNames,
  calculateReleaseState,
} = require("../utils/utils.js");
const {
  validateRelease,
} = require("../validation/validation.js");
const RELEASE_STATES = require("../utils/releaseStates.js");


/**
 * Schedule new Firebase Android SDK releases.
 * This function overwrites the previous upcoming releases and replaces them
 * with the new ones. To avoid removing unmodified releases, keep them in the
 * request so that they are added back.
 * @param {Object} req - The request from the client.
 * @param {Object} res - The response object to be sent to the client.
 * @return {Promise<void>}
 */
async function scheduleReleases(req, res) {
  // Verify method
  log("Received HTTP Request",
      {
        hostname: req.hostname,
        method: req.method,
        body: req.body,
      });
  if (req.method != "POST") {
    warn("Invalid method", {req: req});
    res.status(405).send("Method Not Allowed");
  }

  // TODO: Authenticate request

  try {
    // Verify the format of the releases
    const newReleases = req.body.releases;
    try {
      log("Validating the format of the new upcoming releases",
          {newReleases: newReleases});
      const previousReleaseData = await getPreviousReleaseData();
      const validationErrors =
        validateNewReleases(newReleases, previousReleaseData);
      if (validationErrors.length > 0) {
        // There are errors in the releases, so abort scheduling
        warn("Requests releases did not pass validation checks",
            {
              hostname: req.hostname,
              status: 400,
              errors: validationErrors,
            });
        return res.status(400).json({errors: validationErrors});
      }
    } catch (err) {
      error("Failed to retrieve previous release data", {
        hostname: req.hostname,
        status: 500,
        error: err.message,
        body: req.body,
        headers: req.headers,
      });
      return res.status(500).send("Internal Server Error");
    }


    // Delete all upcoming releases from Firestore
    // We have to wait for this function, otherwise it is possible
    // to write the new upcoming releases before we delete the old upcoming
    // releases, resulting in just deleting the new upcoming releases as well.
    await deleteUpcomingReleases();

    // Write the updated upcoming releases to Firestore
    try {
      // Convert the new releases JSON to a format that is able
      // to be stored in Firestore. We only need to change the string
      // timestamps to Firestore timestamps.
      const releasesWithConvertedDates =
        convertDatesToTimestamps(newReleases);

      await addReleases(releasesWithConvertedDates);
      log("Releases scheduled sucessfully",
          {
            hostname: req.hostname,
            releases: req.body,
            status: 200,
          });
      return res.status(200).send("OK");
    } catch (err) {
      error("Failed to schedule releases in Firestore",
          {
            hostname: req.hostname,
            status: 500,
            error: err.message.message,
            body: req.body,
          });
      return res.status(500).send("Internal Server Error");
    }
  } catch (err) {
    warn("Unauthorized request",
        {
          hostname: req.hostname,
          status: 403,
          error: err.message,
          body: req.body,
          headers: req.headers,
        });
    return res.status(403).send("Unauthorized");
  }
}

/**
 * Refreshes the Firestore data for a specific GitHub release.
 *
 * This function first validates the incoming HTTP request, then
 * uses the provided GitHub release name to fetch the corresponding Firestore
 * document. If a matching document is found, it then updates the document
 * with the latest release information from GitHub.
 *
 * @param {Object} req - The request from the client.
 * @param {Object} res - The response object to be sent to the client.
 */
async function refreshRelease(req, res) {
  log("Received HTTP Request",
      {
        hostname: req.hostname,
        method: req.method,
        body: req.body,
      });

  // Reject non-POST methods
  if (req.method !== "POST") {
    warn("Invalid method", {req: req});
    return res.status(405).send("Method Not Allowed");
  }

  // TODO: Authenticate request

  // Validate the request body
  if (!req.body || !req.body.releaseName) {
    warn("Missing release name in request body", {body: req.body});
    return res.status(400).send("Bad Request - Missing release name");
  }

  // Lookup the Firestore document corresponding to the release
  const releaseId = await getReleaseID(req.body.releaseName);

  // Attempt to sync the release data with GitHub, and handle any errors
  try {
    const octokit = new Octokit({auth: GITHUB_TOKEN.value()});
    log("Syncing release state", {releaseId: releaseId});
    await syncReleaseState(releaseId, octokit);
  } catch (err) {
    error("Failed to sync release state", {error: err.message});
    return res.status(500).send("Internal Server Error");
  }

  // If all goes well, respond with a success status
  log("Successfully refreshed release",
      {
        releaseId: releaseId,
        status: 200,
        body: req.body,
      });
  return res.status(200).send("OK");
}

/**
 * Retrieve all the data for all releases from Firestore, and return
 * it as an array of release objects. This function is used to fetch
 * the data for the release dashboard.
 *
 * @param {Object} req - The request from the client.
 * @param {Object} res - The response object to be sent to the client.
 * @return {Promise<void>}
 */
async function getReleases(req, res) {
  log("Received HTTP Request",
      {
        hostname: req.hostname,
        method: req.method,
        body: req.body,
      });

  if (req.method !== "GET") {
    warn("Invalid method", {req: req});
    return res.status(405).send("Method Not Allowed");
  }

  const db = admin.firestore();

  try {
    // TODO: Move DB call outside this function
    const releasesSnapshot = await db.collection("releases").get();

    // Prepare to fetch associated data for each release
    const releasesPromises = releasesSnapshot.docs.map(async (releaseDoc) => {
      const releaseData = releaseDoc.data();

      // Convert Firestore Timestamps to JavaScript Dates
      if (releaseData.codeFreezeDate) {
        releaseData.codeFreezeDate = releaseData.codeFreezeDate.toDate();
      }
      if (releaseData.releaseDate) {
        releaseData.releaseDate = releaseData.releaseDate.toDate();
      }

      // Fetch all libraries for this release
      const librariesSnapshot = await db.collection("libraries")
          .where("releaseID", "==", releaseDoc.id)
          .get();

      const librariesPromises = librariesSnapshot.docs.map(
          async (libraryDoc) => {
            let libraryData = libraryDoc.data(); // get library data
            libraryData = {...libraryData}; // convert to plain object

            // Fetch all changes for this library
            const changesSnapshot = await db.collection("changes")
                .where("libraryID", "==", libraryDoc.id)
                .get();

            libraryData.changes = changesSnapshot.docs.map(
                (changeDoc) => changeDoc.data(),
            );

            return libraryData;
          });

      releaseData.libraries = await Promise.all(librariesPromises);

      // Fetch all checks for this release
      const checksSnapshot = await db.collection("checks")
          .where("releaseID", "==", releaseDoc.id)
          .get();

      releaseData.checks = checksSnapshot.docs.map(
          (checkDoc) => checkDoc.data(),
      );

      return releaseData;
    });

    // Wait for all data fetching to complete
    const releases = await Promise.all(releasesPromises);

    log("Sucessfully fetched releases", {releases: releases});
    // Return the complete release data
    res.status(200).json(releases);
  } catch (err) {
    error("Failed to get release data", {error: err.message});
    res.status(500).send("Failed to get release data");
  }
}

/**
 * Modify the release data for a specific release.
 *
 * @param {Object} req - The request from the client.
 * @param {Object} res - The response object to be sent to the client.
 * @return {Promise<void>}
 */
async function modifyRelease(req, res) {
  log("Received HTTP Request",
      {
        hostname: req.hostname,
        method: req.method,
        body: req.body,
      });

  if (req.method !== "POST") {
    warn("Invalid method", {req: req});
    return res.status(405).send("Method Not Allowed");
  }

  // TODO: Authenticate the request

  const releaseData = req.body;
  if (!releaseData) {
    warn("Missing release data in request body",
        {req: req});
    return res.status(400).send("Invalid request");
  }

  log("Validating release data", {releaseData: releaseData});

  // Verify the format of the release
  const errors = validateRelease(releaseData);
  if (errors.length > 0) {
    warn("request validation errors", {errors: errors});
    return res.status(400).json({errors});
  }

  // Get the release ID of the release to modify
  let releaseId;
  try {
    releaseId = await getReleaseID(releaseData.releaseName);
  } catch (err) {
    warn("Error getting release ID", {error: err.message});
    return res.status(404).send("Release not found");
  }

  // Update the release data in Firestore
  try {
    const releasesWithConvertedDates =
        convertDatesToTimestamps(releaseData);
    updateRelease(releaseId, releasesWithConvertedDates);
    log("Successfully updated release",
        {releaseId: releaseId, releaseData: releaseData});
  } catch (err) {
    warn("Error updating release", {error: err.message});
    return res.status(500).send("Error updating release");
  }

  const octokit = new Octokit({auth: GITHUB_TOKEN.value()});

  // Since we've successfully updated the release, our
  // release data is now going to be out of sync with the
  // new release branch. To make sure that the release data
  // is up to date, we need to sync the release state.
  // If there are issues with the new release branch,
  // the release state will be set to "error".
  try {
    await syncReleaseState(releaseId, octokit);
    log("Successfully updated release and re-synced", {req: req});
  } catch (err) {
    warn("Error re-syncing release", {error: err.message});
    return res.status(500).send("Internal Server Error");
  }

  return res.status(200).send("OK");
}

/**
 * Syncs the state of a release. This function infers the current state of the
 * release, updates its state in the database, and fetches data from GitHub
 * if the release
 * is not upcoming or scheduled. It also handles possible errors and updates
 * the release state to "error" if an exception is thrown.
 *
 * @param {string} releaseId - The ID of the release to sync.
 * @param {Object} octokit - The Octokit instance for interacting with the
 * GitHub API.
 * @throws Will throw an error if the release branch does not exist or if
 * any of the promises reject.
 */
async function syncReleaseState(releaseId, octokit) {
  // Get the release document from Firestore
  const releaseData = await getReleaseData(releaseId);

  log("Release data before sync", {releaseData: releaseData});

  // Infer the state of the release from the collected data
  let releaseState = calculateReleaseState(
      releaseData.codeFreezeDate.toDate(),
      releaseData.releaseDate.toDate(),
      releaseData.isComplete);

  log("Inferred release state", {releaseState: releaseState});

  if (releaseState === RELEASE_STATES.UPCOMING ||
    releaseState === RELEASE_STATES.SCHEDULED) {
    // If the release is upcoming or scheduled, we don't need to
    // fetch any data from GitHub, so we can just update the release
    // state and return
    await updateReleaseState(releaseId, releaseState);
    return;
  }

  const releaseBranchExists = await checkReleaseBranchExists(
      octokit,
      releaseData.releaseBranchName,
  );

  if (!releaseBranchExists) {
    log("Release branch does not exist", {releaseData: releaseData});
    releaseState = RELEASE_STATES.UPCOMING;
    await updateReleaseState(releaseId, releaseState);
    throw new Error("Release branch does not exist");
  }

  // Since the release branch exists, we can fetch data from GitHub
  // to update the release state
  try {
    // Perform tasks that can be done in parallel
    const [
      releaseConfig,
      releaseReport,
      buildArtifactWorkflow,
    ] = await Promise.all([
      getReleaseConfig(octokit, releaseData),
      getReleaseReport(octokit, releaseData),
      getBuildArtifactsWorkflow(octokit, releaseData.releaseBranchName),
    ]);

    log("Fetched github data",
        {
          releaseConfig: releaseConfig,
          releaseReport: releaseReport,
          buildArtifactWorkflow: buildArtifactWorkflow,
        });

    // Process the library names to get correct format
    processLibraryNames(releaseConfig);

    // For each library in the release config, extract the version
    const libraryVersions = await getLibraryVersions(
        octokit, releaseData, releaseConfig);

    // Get the status of the check suite running on the release branch
    const checkRuns = await listCheckRuns(octokit,
        releaseData.releaseBranchName);
    const checkRunList = checkRuns.map((checkRun) => ({
      id: checkRun.id,
      name: checkRun.name,
      headSHA: checkRun.head_sha,
      status: checkRun.status,
      conclusion: checkRun.conclusion,
      outputTitle: checkRun.output ? checkRun.output.title : null,
      httpsUrl: checkRun.html_url,
    }));

    // TODO: Determine which libraries were manually opted in to the release
    // and which ones were automatically included using diffs between the
    // release report and the release config. Add flag to opted in libraries.

    // Update release data in parallel
    await Promise.all([
      updateLibrariesForRelease(libraryVersions, releaseId),
      updateChecksForRelease(checkRunList, releaseId),
    ]);

    // We can't do this in parallel because we need the libraries
    // to be updated first. If we do this in parallel we might
    // create a change for a library that doesn't exist yet,
    // which will cause an error.
    await updateChangesForRelease(releaseReport, releaseId);

    const updatedReleaseData = {
      state: releaseState,
      buildArtifactStatus: buildArtifactWorkflow.status,
      buildArtifactConclusion: buildArtifactWorkflow.conclusion,
      buildArtifactLink: buildArtifactWorkflow.html_url,
      buildArtifactJobId: buildArtifactWorkflow.id,
    };

    log("Updating release state",
        {
          releaseId: releaseId,
          releaseData: updatedReleaseData,
        });

    await updateRelease(releaseId, updatedReleaseData);
  } catch (err) {
    await updateReleaseState(releaseId, {state: RELEASE_STATES.ERROR});
    error("Failed to sync release for a release that has passed code freeze"
        , {releaseId: releaseId, error: err.message});
    throw err;
  }
}

module.exports = {
  scheduleReleases,
  refreshRelease,
  getReleases,
  modifyRelease,
};
