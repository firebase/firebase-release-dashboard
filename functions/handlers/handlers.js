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
  setReleases,
  getReleaseID,
  updateRelease,
  updateReleaseState,
  updateChecksForRelease,
  updateChangesForRelease,
  updateLibrariesForRelease,
  getReleaseData,
  deleteAllReleaseData,
  releaseExists,
  setReleaseError,
} = require("../database/database.js");
const {
  getReleaseConfig,
  getReleaseReport,
  getBuildArtifactsWorkflow,
  listCheckRuns,
  getLibraryMetadata,
  getReleaseBranch,
} = require("../github/github.js");
const {
  validateNewReleases,
  validateRelease,
} = require("../validation/validation.js");
const {
  convertReleaseDatesToTimestamps,
  processLibraryNames,
  calculateReleaseState,
  filterOutKtx,
  mergeKtxIntoRoot,
  getStackTrace,
} = require("../utils/utils.js");
const {authenticateUser} = require("../utils/auth.js");
const RELEASE_STATES = require("../utils/releaseStates.js");


/**
 * Add new Firebase Android SDK releases.
 *
 * Used to add upcoming or previous releases to the database.
 * Based on the release dates, the release state will be inferred and set
 * automatically, and then the release will be synced.
 *
 * @param {Object} req - The request from the client.
 * @param {Object} res - The response object to be sent to the client.
 * @return {Promise<void>}
 */
async function addReleases(req, res) {
  log("Received HTTP Request",
      {
        hostname: req.hostname,
        method: req.method,
        body: req.body,
      });

  authenticateUser(req, res, async () => {
    if (req.method != "POST") {
      warn("Invalid method", {req: req});
      res.status(405).send("Method Not Allowed");
    }

    const releaseData = req.body.releases;
    if (!releaseData) {
      warn("Missing release data in request body", {req: req});
      return res.status(400).send("Invalid Request");
    }

    // Validate the format of the releases, and return meaningful errors
    // if there are any
    try {
      const validationErrors = validateNewReleases(releaseData);
      if (validationErrors.length > 0) {
        warn("Request releases did not pass validation checks",
            {errors: validationErrors});
        return res.status(400).json({errors: validationErrors});
      }
    } catch (err) {
      error("Failed to validate release data", {error: err.message});
      return res.status(500).send("Internal Server Error");
    }

    // Validate that none of the releases already exist in Firestore
    try {
      for (const release of releaseData) {
        const releaseId = await getReleaseID(release.releaseName);
        if (releaseId) {
          warn("Release already exists in Firestore",
              {
                release: release,
                releaseID: releaseId,
              });
          return res.status(400).send(
              `Invalid Request - ${release.releaseName} already exists`,
          );
        }
      }
    } catch (err) {
      error("Error while verifying uniqueness of release names",
          {error: err.message});
      return res.status(500).send("Internal Server Error");
    }

    // Convert the new releases JSON to a format that is able
    // to be stored in Firestore. We only need to change the string
    // timestamps to Firestore timestamps.
    let releasesWithConvertedDates;
    try {
      releasesWithConvertedDates = convertReleaseDatesToTimestamps(releaseData);
    } catch (err) {
      error("Error while converting dates to timestamps", {error: err.message});
      return res.status(500).send("Internal Server Error");
    }

    // Write the new releases to Firestore
    try {
      await setReleases(releasesWithConvertedDates);
      log("Releases added sucessfully",
          {
            hostname: req.hostname,
            releases: req.body,
            status: 200,
          });
    } catch (err) {
      error("Failed to store releases in Firestore",
          {
            hostname: req.hostname,
            status: 500,
            error: err.message.message,
            body: req.body,
          });
      return res.status(500).send("Internal Server Error");
    }

    let octokit;
    try {
      octokit = new Octokit({auth: GITHUB_TOKEN.value()});
    } catch (err) {
      error("Failed to create Octokit instance", {error: err.message});
      return res.status(500).send("Internal Server Error");
    }

    // Sync the release state for each release
    // Since the release names are unique, we can safely sync
    // each release in parallel.

    const promises = releasesWithConvertedDates.map(async (release) => {
      try {
        const releaseId = await getReleaseID(release.releaseName);
        if (!releaseId) {
          error("Failed to get release ID for new release", {release: release});
          return Promise.reject(new Error("Failed to get release ID"));
        }
        await syncReleaseState(releaseId, octokit);
      } catch (err) {
        warn("Failed to sync release state for new release",
            {
              error: err.message,
              release: release,
            });
      }
    });

    // Even if one of the syncs fails, we still want to return a 200.
    // Since these releases were validated, we assume that the releases
    // failed to sync for a reason that is not the client's fault.
    // If the sync fails for a reason that is the client's fault, then
    // we leave it to the client to correctly identify why it failed, modify
    // the release, and retry the sync. Reasons for failure include: incorrect
    // branch naming, creating a release that does not have a valid branch (e.g.
    // no release config, release report, etc...), or inaccurate dates.
    // The releases that failed to sync will simply be in an error state,
    // and the client can retry the sync later.
    await Promise.all(promises);

    return res.status(200).send("OK");
  });
}

/**
 * Refreshes the Firestore data for a specific GitHub release.
 *
 * Validates the incoming HTTP request, then
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

  authenticateUser(req, res, async () => {
    // Reject non-POST methods
    if (req.method !== "POST") {
      warn("Invalid method", {req: req});
      return res.status(405).send("Method Not Allowed");
    }

    // Validate the request body
    if (!req.body || !req.body.releaseId) {
      warn("Missing release id in request body", {body: req.body});
      return res.status(400).send("Bad Request");
    }

    // Check if the release exists
    const releaseId = req.body.releaseId;
    const exists = await releaseExists(releaseId);
    if (!exists) {
      warn("Release does not exist", {releaseId: releaseId});
      return res.status(404).send("Not Found");
    }

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
  });
}

/**
 * Retrieve all the data for all releases from Firestore, and return
 * it as an array of release objects.
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

      // Add the document ID to the release data to allow for clients to
      // refer to the release by its ID in future requests.
      releaseData.id = releaseDoc.id;

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

  authenticateUser(req, res, async () => {
    if (req.method !== "POST") {
      warn("Invalid method", {req: req.method});
      return res.status(405).send("Method Not Allowed");
    }

    if (!req.body || !req.body.releaseId) {
      warn("Missing release ID in request body", {req: req});
      return res.status(400).send("Invalid request");
    }

    // Check if the release exists
    const releaseId = req.body.releaseId;
    const exists = await releaseExists(releaseId);
    if (!exists) {
      warn("Release does not exist", {releaseId: releaseId});
      return res.status(404).send("Not Found");
    }

    const releaseData = req.body.release;
    if (!releaseData) {
      warn("Missing release data in request body",
          {req: req});
      return res.status(400).send("Invalid request");
    }

    log("Validating release data", {releaseData: releaseData});

    // Verify the format of the release data
    const errors = validateRelease(releaseData);
    if (errors.length > 0) {
      warn("request validation errors", {errors: errors});
      return res.status(400).json({errors});
    }

    const octokit = new Octokit({auth: GITHUB_TOKEN.value()});

    let releasesWithConvertedDates;
    try {
      releasesWithConvertedDates = convertReleaseDatesToTimestamps(releaseData);
    } catch (err) {
      warn("Error while converting dates to timestamps", {error: err.message});
      return res.status(500).send("Internal Server Error");
    }

    const release = releasesWithConvertedDates[0];

    // Update the release data in Firestore
    try {
      await updateRelease(releaseId, release);
      log("Successfully updated release",
          {releaseId: releaseId, release: release});
    } catch (err) {
      warn("Error updating release", {error: err.message});
      return res.status(500).send("Internal Server Error");
    }

    // Since we've successfully updated the release, our
    // release data is now going to be out of sync with the
    // new release branch. To make sure that the release data
    // is up to date, we need to sync the release state.
    // If there are issues with the new release branch,
    // the release state will be set to "error".
    try {
      await syncReleaseState(releaseId, octokit);
      log("Successfully updated release and re-synced",
          {releaseID: releaseId});
    } catch (err) {
      warn("Error re-syncing release", {error: err.message});
      return res.status(500).send("Internal Server Error");
    }


    return res.status(200).send("OK");
  });
}

/**
 * Syncs the state of a release. Infers the current state of the
 * release, updates its state in the database, and fetches data from GitHub
 * if the release is active. It also handles possible errors and updates
 * the release state to "error" if an exception is thrown.
 *
 * We store the logs in Firestore so that we can view them provide
 * context for any errors that occur in the dashboard. We only store errors
 * here because this is the only place where a release may enter an error
 * state.
 *
 * @param {string} releaseId - The ID of the release to sync.
 * @param {Object} octokit - The Octokit instance for interacting with the
 * GitHub API.
 * @throws {Error} If the release state cannot be determined from the
 * state of the release. If a sync fails, the release state will be set to
 * "error", and the release operator must resolve the issue and attempt
 * to sync again.
 */
async function syncReleaseState(releaseId, octokit) {
  // Get the release document from Firestore
  const releaseData = await getReleaseData(releaseId);

  log("Release data before sync", {releaseData: releaseData});

  // Infer the state of the release from the collected data
  const releaseState = calculateReleaseState(
      releaseData.codeFreezeDate.toDate(),
      releaseData.releaseDate.toDate(),
      releaseData.isComplete);

  log("Inferred release state", {releaseState: releaseState});

  if (releaseState === RELEASE_STATES.SCHEDULED) {
    // If the release is scheduled, we don't need to
    // fetch any data from GitHub, so we can just update the release
    // state and return
    await updateReleaseState(releaseId, releaseState);
    return;
  }

  // If we can get the release branch, then we know that it exists.
  // If the request fails, we know that the release branch does not exist.
  // If release release has passed the codeFreezeDate but the release
  // branch does not exist, we can't proceed with syncing the release.
  // The release branch should exist at this point, so we enter an
  // error state.
  try {
    await getReleaseBranch(
        octokit,
        releaseData.releaseBranchName,
    );
  } catch (err) {
    await handleReleaseError(
        releaseId,
        err,
        "Could not retrieve the release branch from GitHub.",
    );
    throw err;
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

    const libraryNames = filterOutKtx(releaseConfig.libraries);
    const libraryChanges = mergeKtxIntoRoot(releaseReport.changesByLibraryName);

    log("Processed data",
        {libraryNames: libraryNames, libraryChanges: libraryChanges});

    // For each library in the release config, extract the version
    const libraryMetadata = await getLibraryMetadata(
        octokit,
        releaseData.releaseBranchName,
        libraryNames,
        libraryChanges,
    );

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

    // Update release data in parallel
    await Promise.all([
      updateLibrariesForRelease(libraryMetadata, releaseId),
      updateChecksForRelease(checkRunList, releaseId),
    ]);

    // We can't do this in parallel because we need the libraries
    // to be updated first. If we do this in parallel we might
    // create a change for a library that doesn't exist yet,
    // which will cause an error.
    await updateChangesForRelease(libraryChanges, releaseId);

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
    await handleReleaseError(
        releaseId,
        err,
        "Failed to sync release data from release branch on GitHub",
    );
    throw err;
  }
}

/**
 * Delete the release data for a specific release.
 *
 * @param {Object} req - The request from the client.
 * @param {Object} res - The response object to be sent to the client.
 * @return {Promise<void>}
 */
async function deleteRelease(req, res) {
  log("Received HTTP Request",
      {
        hostname: req.hostname,
        method: req.method,
        body: req.body,
      });

  authenticateUser(req, res, async () => {
    // Reject non-POST methods
    if (req.method !== "POST") {
      warn("Invalid method", {req: req});
      return res.status(405).send("Method Not Allowed");
    }

    // Validate the request body
    if (!req.body || !req.body.releaseId) {
      warn("Missing release id in request body", {body: req.body});
      return res.status(400).send("Bad Request");
    }

    // Check if the release exists
    const releaseId = req.body.releaseId;
    const exists = await releaseExists(releaseId);
    if (!exists) {
      warn("Release does not exist", {releaseId: releaseId});
      return res.status(404).send("Not Found");
    }

    // Delete all the data for the release
    try {
      log("Deleting release data", {releaseId: releaseId});
      await deleteAllReleaseData(releaseId);
    } catch (err) {
      error("Failed to delete release data", {error: err.message});
      return res.status(500).send("Internal Server Error");
    }

    log(
        "Successfully deleted release data",
        {releaseId: releaseId},
    );
    return res.status(200).send("OK");
  });
}

/**
 * Handles errors that occur while syncing a release.
 *
 * Logs the error, sets the release state to "error", and stores the error
 * in Firestore. The error can then be viewed in the dashboard, along
 * with the stack trace.
 *
 * @param {string} releaseId
 * @param {Error} err - The error that occurred.
 * @param {string} contextMsg - A message to provide context for the error.
 */
async function handleReleaseError(releaseId, err, contextMsg) {
  error("Error while syncing release",
      {releaseId: releaseId,
        error: err.message,
      },
  );

  const stackTrace = getStackTrace(err);
  await setReleaseError(
      releaseId,
      err.message,
      stackTrace,
      contextMsg,
  );
  await updateReleaseState(releaseId, RELEASE_STATES.ERROR);
}


module.exports = {
  addReleases,
  refreshRelease,
  getReleases,
  modifyRelease,
  deleteRelease,
  syncReleaseState,
};
