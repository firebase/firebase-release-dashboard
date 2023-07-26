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
} = require("../database/database.js");
const {
  checkReleaseBranchExists,
  getReleaseConfig,
  getReleaseReport,
  getBuildArtifactsWorkflow,
  listCheckRuns,
  getLibraryMetadata,
} = require("../github/github.js");
const {validateNewReleases} = require("../validation/validation.js");
const {
  convertReleaseDatesToTimestamps,
  processLibraryNames,
  calculateReleaseState,
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
    if (!req.body || !req.body.releaseName) {
      warn("Missing release name in request body", {body: req.body});
      return res.status(400).send("Bad Request - Missing release name");
    }

    // Lookup the Firestore document corresponding to the release
    let releaseId;
    try {
      releaseId = await getReleaseID(req.body.releaseName);
      if (!releaseId) {
        warn("Release not found in Firestore",
            {releaseName: req.body.releaseName});
        return res.status(400).send("Invalid Request");
      }
    } catch (err) {
      warn("Error getting release ID", {error: err.message});
      return res.status(400).send("Invalid Request");
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
async function modifyReleases(req, res) {
  log("Received HTTP Request",
      {
        hostname: req.hostname,
        method: req.method,
        body: req.body,
      });

  authenticateUser(req, res, async () => {
    if (req.method !== "POST") {
      warn("Invalid method", {req: req});
      return res.status(405).send("Method Not Allowed");
    }

    const releaseData = req.body.releases;
    if (!releaseData) {
      warn("Missing release data in request body",
          {req: req});
      return res.status(400).send("Invalid request");
    }

    log("Validating release data", {releaseData: releaseData});

    // Verify the format of the release
    const errors = validateNewReleases(releaseData);
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
      return res.status(400).send("Invalid request");
    }

    for (const release of releasesWithConvertedDates) {
      // Get the release ID of the release to modify
      let releaseId;
      try {
        releaseId = await getReleaseID(release.releaseName);
        if (!releaseId) {
          warn("Release not found in Firestore", {release: release});
          return res.status(400).send("Invalid Request");
        }
      } catch (err) {
        warn("Error getting release ID", {error: err.message});
        return res.status(400).send("Invalid request");
      }

      // Update the release data in Firestore
      try {
        await updateRelease(releaseId, release);
        log("Successfully updated release",
            {releaseId: releaseId, release: release});
      } catch (err) {
        warn("Error updating release", {error: err.message});
        return res.status(500).send("Error updating release");
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

  const releaseBranchExists = await checkReleaseBranchExists(
      octokit,
      releaseData.releaseBranchName,
  );

  // If release release has passed the codeFreezeDate but the release
  // branch does not exist, we can't proceed with syncing the release.
  // The release branch should exist at this point, so we enter an
  // error state.
  if (!releaseBranchExists) {
    log("Release branch does not exist", {releaseData: releaseData});
    await updateReleaseState(releaseId, RELEASE_STATES.ERROR);
    throw new Error(
        `Release branch ${releaseData.releaseBranchName} does not exist`,
    );
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
    const libraryMetadata = await getLibraryMetadata(
        octokit,
        releaseData.releaseBranchName,
        releaseReport,
        releaseConfig,
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
    await updateReleaseState(releaseId, RELEASE_STATES.ERROR);
    error("Failed to sync release for a release that has passed code freeze"
        , {releaseId: releaseId, error: err.message});
    throw err;
  }
}

/**
 * Modify the release data for a specific release.
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
    if (!req.body || !req.body.releaseName) {
      warn("Missing release name in request body", {body: req.body});
      return res.status(400).send("Bad Request");
    }

    // Check that the release exists
    let releaseId;
    try {
      releaseId = await getReleaseID(req.body.releaseName);
      if (!releaseId) {
        warn("Release not found in Firestore",
            {releaseName: req.body.releaseName});
        return res.status(404).send("Not Found");
      }

      log("Release exists", {releaseName: req.body.releaseName});
    } catch (err) {
      error("Error getting release ID", {error: err.message});
      return res.status(500).send("Internal Server Error");
    }

    // Delete all the data for the release
    try {
      await deleteAllReleaseData(releaseId);
    } catch (err) {
      error("Failed to delete release data", {error: err.message});
    }

    log(
        "Successfully deleted release data",
        {releaseName: req.body.releaseName},
    );
    return res.status(200).send("OK");
  });
}


module.exports = {
  addReleases,
  refreshRelease,
  getReleases,
  modifyReleases,
  deleteRelease,
  syncReleaseState,
};
