const functions = require("firebase-functions/v2");
const {defineSecret} = require("firebase-functions/params");
const admin = require("firebase-admin");
const {initializeApp} = require("firebase-admin/app");
initializeApp({
  credential: admin.credential.applicationDefault(),
});
const {Timestamp} = require("firebase-admin/firestore");
const db = admin.firestore();
const {
  log,
  warn,
  error,
} = require("firebase-functions/logger");

const ERRORS = require("./utils/errors");
const RELEASE_STATES = require("./releaseStates");

const {Octokit} = require("@octokit/rest");
const GITHUB_TOKEN = defineSecret("GITHUB_TOKEN");


/**
 * Helper function to check the release name format.
 * The format of release names must be "M<releaseNumber>"
 * @param {string} name - The release name.
 * @return {bool} - True if the release name is valid.
 */
function isValidReleaseName(name) {
  const re = /^M\d+$/;
  return re.test(name);
}

/** Helper function to check that a date is in the future
 * @param {string} date - The date in string format.
 * @return {bool} - True if the date is in the future.
 */
function isFutureDate(date) {
  return new Date(date) > new Date();
}

/**
 * Extracts release numbers from an array of Firestore release documents.
 * @param {Array} releaseData - An array of Firestore release document data.
 * @return {Array} An array of release numbers.
 * @throws {TypeError} If `docs` is not an array.
 * @throws {Error} If a document does not have an ID in the expected format.
 */
function getReleaseNumbers(releaseData) {
  if (!Array.isArray(releaseData)) {
    throw new TypeError("Expected an array of documents");
  }

  return releaseData.map((doc) => {
    const releaseName = doc.releaseName;

    if (releaseName && typeof releaseName !== "string") {
      throw new Error("Each document should have a name string field");
    }

    const releaseNumber = parseInt(releaseName.slice(1), 10);
    if (Number.isNaN(releaseNumber)) {
      throw new Error("Could not extract release number from release name");
    }

    return releaseNumber;
  });
}

/** Validation checks for a set of upcoming releases. This function is only
 * intended to be used to validate releases that are to be scheduled, and not
 * already existing releases.
 * @param {Object} newReleases - A set of upcoming releases to be validated
 * @param {Object} previousReleaseData - Release document data from Firestore.
 * @return {Object} list of errors from the validation of the releases.
 */
function validateNewReleases(newReleases, previousReleaseData) {
  const errors = [];
  const previousReleaseNumbers = getReleaseNumbers(previousReleaseData);
  const maxPreviousReleaseNumber = Math.max(...previousReleaseNumbers, -1);

  // Validate that there are releases
  if (!newReleases) {
    errors.push({
      message: ERRORS.NO_RELEASES,
    });
    return errors;
  }

  let previousReleaseNumber = maxPreviousReleaseNumber;
  for (const release of newReleases) {
    // Validate that all the release fields are present
    if (!release.releaseName || !release.releaseOperator ||
      !release.codeFreezeDate || !release.releaseDate) {
      errors.push({
        message: ERRORS.MISSING_RELEASE_FIELD,
        offendingRelease: release,
      });
    }

    // Validate that the release name is valid and unique
    if (typeof release.releaseName != "string" ||
    release.releaseName.trim() === "") {
      errors.push({
        message: ERRORS.INVALID_RELEASE_FIELD,
        offendingRelease: release,
      });
    }

    // Validate release name format
    if (!isValidReleaseName(release.releaseName)) {
      errors.push({
        message: ERRORS.INVALID_RELEASE_NAME,
        offendingRelease: release,
      });
    } else {
      // Now that we know the release name is a valid format, we can
      // parse it, and check that the new release number is
      // monotonically increasing
      const releaseNumber = parseInt(release.releaseName.slice(1));

      if (previousReleaseNumber != -1 &&
        releaseNumber !== previousReleaseNumber + 1) {
        errors.push({
          message: ERRORS.NON_MONOTONIC_RELEASE_NUMBER,
          offendingRelease: release,
        });
      }
      previousReleaseNumber = releaseNumber;
    }

    // Check that the release operator exists
    if (!release.releaseOperator) {
      errors.push({
        message: ERRORS.MISSING_RELEASE_FIELD,
        offendingRelease: release,
      });
    } else if (typeof release.releaseOperator !== "string" ||
      release.releaseOperator.trim() === "") {
      errors.push({
        message: ERRORS.INVALID_RELEASE_FIELD,
        offendingRelease: release,
      });
    }

    // Check that the dates are real dates that are in the future
    if (!isFutureDate(release.codeFreezeDate) ||
    !isFutureDate(release.releaseDate)) {
      errors.push({
        message: ERRORS.INVALID_DATE,
        offendingRelease: release,
      });
    }

    // Check that the code freeze date is before the release date
    if (new Date(release.releaseDate) <= new Date(release.codeFreezeDate)) {
      errors.push({
        message: ERRORS.CODEFREEZE_AFTER_RELEASE,
        offendingRelease: release,
      });
      errors.push({message: "Release date must be after code freeze date"});
    }
  }

  // Check that the releases' dates don't overlap
  for (let i = 0; i < newReleases.length; i++) {
    for (let j = i + 1; j < newReleases.length; j++) {
      if (new Date(newReleases[i].releaseDate) >
            new Date(newReleases[j].codeFreezeDate)) {
        errors.push({
          message: ERRORS.RELEASE_OVERLAP,
          offendingRelease: newReleases[i],
        });
      }
    }
  }

  return errors;
}

/** Retrieve all past releases from Firestore.
 *  This includes releases that are currently active.
 * @return {Promise<Array>} Returns a promise that resolves to an array
 * of Firestore document data of past releases.
 * @throws {Error} If there is an error in fetching data from Firestore,
 * the promise is rejected with an error.
 */
async function getPreviousReleaseData() {
  try {
    const today = new Date();
    const snapshot = await db.collection("releases")
        .where("releaseDate", "<", today)
        .get();

    const pastReleases = [];
    snapshot.forEach((doc) => {
      pastReleases.push(doc.data());
    });

    return pastReleases;
  } catch (err) {
    error("Error in fetching past releases from Firestore:", {error: err});
    throw err;
  }
}

/**
 * Validates new releases before they are stored in Firestore.
 * This is primarily to ensure the date format is held, and not to ensure
 * that any logical errors don't exist in the code.
 * @param {Array} newReleases - New releases to validate
 */
function validateNewReleaseStructure(newReleases) {
  if (!Array.isArray(newReleases)) {
    throw new Error("New releases should be an array");
  }

  // Validate each release object
  newReleases.forEach((release) => {
    if (typeof release != "object") {
      throw new Error("Each release should be an object");
    }

    // Check that all required fields are present and of the correct type
    if (!Object.prototype.hasOwnProperty.call(release, "releaseName") ||
    typeof release.releaseName !== "string") {
      throw new Error("Each release should have a string property"+
      " 'releaseName'");
    }

    if (!Object.prototype.hasOwnProperty.call(release, "releaseOperator") ||
    typeof release.releaseOperator !== "string") {
      throw new Error("Each release should have a string property" +
      " 'releaseName'");
    }

    if (!Object.prototype.hasOwnProperty.call(release, "codeFreezeDate") ||
    !(release.codeFreezeDate instanceof Timestamp)) {
      throw new Error("Each release should have a Firestore Timestamp"+
      " property 'codeFreezeDate'");
    }

    if (!Object.prototype.hasOwnProperty.call(release, "releaseDate") ||
    !(release.releaseDate instanceof Timestamp)) {
      throw new Error("Each release should have a Firestore Timestamp"+
      " property 'releaseDate'");
    }
  });
}

/** Write new releases to Firestore.
 * This function assumes that the contents of the releases
 * are validated.
 * @param {Object} newReleases - Releases to store in Firestore
 */
async function addReleases(newReleases) {
  // Validate the structure of the new releases
  validateNewReleaseStructure(newReleases);

  const batch = db.batch();

  try {
    newReleases.forEach((release) => {
      const newReleaseRef = db.collection("releases").doc();
      const snapshotBranchName = `releases/${release.releaseName}`;
      const releaseBranchName = `releases/${release.releaseName}.release`;
      const snapshotBranchLink = `https://github.com/firebase/firebase-android-sdk/tree/${snapshotBranchName}`;
      const releaseBranchLink = `https://github.com/firebase/firebase-android-sdk/tree/${releaseBranchName}`;
      const releaseData = {
        state: RELEASE_STATES.SCHEDULED,
        releaseName: release.releaseName,
        releaseOperator: release.releaseOperator,
        codeFreezeDate: release.codeFreezeDate,
        releaseDate: release.releaseDate,
        snapshotBranchName: snapshotBranchName,
        snapshotBranchLink: snapshotBranchLink,
        releaseBranchName: releaseBranchName,
        releaseBranchLink: releaseBranchLink,
        isComplete: false,
        buildArtifactStatus: "",
      };
      batch.set(newReleaseRef, releaseData);
    });

    await batch.commit();
  } catch (err) {
    error(err);
    throw err;
  }
}
/**
 * Delete the releases in Firestore with code freeze dates that are in the
 * future. This is intented to be used when scheduling new upcoming releases,
 * but we need to delete the old upcoming releases before.
 */
async function deleteUpcomingReleases() {
  const today = Timestamp.now();
  const releasesRef = db.collection("releases");
  const query = releasesRef.where("codeFreezeDate", ">", today);

  const querySnapshot = await query.get();

  if (querySnapshot.empty) {
    // console.log("No upcoming releases");
    return;
  }

  const batch = db.batch();

  querySnapshot.forEach((doc) => {
    // console.log("Deleting upcoming release: ", doc.ref.id);
    batch.delete(doc.ref);
  });

  await batch.commit();
}

/**
 * Convert release dates from strings to Firestore Timestamps.
 * @param {Object[]} releases - The releases to convert.
 * @return {Object[]} The releases with converted dates.
 */
function convertDatesToTimestamps(releases) {
  return releases.map((release) => {
    const convertedRelease = {...release};
    ["codeFreezeDate", "releaseDate"].forEach((dateType) => {
      if (release[dateType]) {
        try {
          // Attempt to parse the date string and convert to Firestore Timestamp
          const dateObject = new Date(release[dateType]);
          if (!isNaN(dateObject)) {
            convertedRelease[dateType] =
            Timestamp.fromDate(dateObject);
          } else {
            throw new Error(`Invalid date string format for`+
            `${dateType}: ${release[dateType]}`);
          }
        } catch (err) {
          error(`Error converting ${dateType} to Firestore Timestamp:`,
              err);
          // Handle error or re-throw if needed
          throw err;
        }
      }
    });
    return convertedRelease;
  });
}

/**
 * Schedule new Firebase Android SDK releases.
 * This function overwrites the previous upcoming releases and replaces them
 * with the new ones. To avoid removing unmodified releases, keep them in the
 * request so that they are added back.
 * @param {Object} req - The request from the client.
 * @param {Object} res - The response object to be sent to the client.
 * @returns {Promise<void>}
 */
exports.scheduleReleases = functions.https.onRequest(async (req, res) => {
  // Verify method
  log("Received HTTP Request",
      {
        hostname: req.hostname,
        method: req.method,
        body: req.body,
      });
  if (req.method != "POST") {
    res.status(405).send("Method Not Allowed");
  }

  // Verify that the request is authenticated, as only administrators
  // can schedule releases.
  /*
  const authorizationHeader = req.headers.authorization || "";
  const components = authorizationHeader.split(" ");

  if (components.length < 2) {
    return res.status(401).send("Unauthorized");
  }

  const idToken = components[1];

  try {
    // Verify the ID token
    await admin.auth().verifyIdToken(idToken);
  } catch (err) {
    warn("Unauthorized request", {
      hostname: req.hostname,
      status: 403,
      error: err,
      headers: req.headers,
    });
    return res.status(403).send("Unauthorized");
  }
  */

  try {
    // Verify the format of the releases
    const newReleases = req.body.releases;
    try {
      log("Validating the format of the new upcoming releases");
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
        error: err,
        body: req.body,
        headers: req.headers,
      });
      return res.status(500).send("Internal Server Error");
    }


    // Delete all upcoming releases from Firestore
    // We have to wait for this function, otherwise it is possible
    // to write the new upcoming releases before we delete the old upcoming
    // releases, resulting in just deleting the new upcoming releases as well.
    log("Deleting all upcoming releases in Firestore...");
    await deleteUpcomingReleases();
    log("Deleted all upcoming releases in Firestore");

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
          });
      return res.status(200).send("Releases scheduled successfully");
    } catch (err) {
      error("Failed to schedule releases in Firestore",
          {
            hostname: req.hostname,
            status: 500,
            error: err,
            body: req.body,
          });
      return res.status(500).send("Error scheduling releases");
    }
  } catch (err) {
    warn("Unauthorized request",
        {
          hostname: req.hostname,
          status: 403,
          error: err,
          body: req.body,
          headers: req.headers,
        });
    return res.status(403).send("Unauthorized");
  }
});

/**
 * Refreshes the Firestore data for a specific GitHub release.
 *
 * This function first validates the incoming HTTP request, then
 * uses the provided GitHub release name to fetch the corresponding Firestore
 * document. If a matching document is found, it then updates the document
 * with the latest release information from GitHub.
 */
exports.refreshRelease = functions.https.onRequest(
    {secrets: [GITHUB_TOKEN]},
    async (req, res) => {
    // Reject non-POST methods
      if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed");
      }

      // Validate the request body
      if (!req.body || !req.body.releaseName) {
        warn("Missing release name in request body", {body: req.body});
        return res.status(400).send("Bad Request - Missing release name");
      }

      // Lookup the Firestore document corresponding to the release
      const releaseName = req.body.releaseName;
      const releaseRef = db.collection("releases")
          .where("releaseName", "==", releaseName);
      const snapshot = await releaseRef.get();

      // If no document is found, abort with a 404 error
      if (snapshot.empty) {
        warn("No matching release", {releaseName});
        return res.status(404).send("Not Found - Release does not exist");
      }

      const releaseId = snapshot.docs[0].id;

      // Attempt to sync the release data with GitHub, and handle any errors
      try {
        const octokit = new Octokit({auth: GITHUB_TOKEN.value()});
        await syncReleaseState(releaseId, octokit);
      } catch (err) {
        error(err);
        return res.status(500).send("Internal Server Error");
      }

      // If all goes well, respond with a success status
      return res.status(200).send("OK");
    });

/**
 * Fetches and returns the content of a specific file from a GitHub repository.
 *
 * @param {Octokit} octokit The authenticated Octokit instance.
 * @param {string} ref The git reference (typically a branch or tag).
 * @param {string} path The path to the file within the repository.
 * @return {Promise<string>} The file's content as a string.
 */
async function getRepositoryContent(octokit, ref, path) {
  log("fetching repository content", {ref, path});
  try {
    // Fetch the file from the GitHub repository
    const response = await octokit.request(
        "GET /repos/{owner}/{repo}/contents/{path}", {
          owner: "firebase",
          repo: "firebase-android-sdk",
          path: path,
          ref: ref,
          headers: {
            "X-GitHub-Api-Version": "2022-11-28",
          },
        });

    // Decode the file content (which is base64 encoded by GitHub)
    const content = Buffer.from(response.data.content, "base64").toString();
    return content;
  } catch (err) {
    error(`Error fetching ${path} on ${ref} from GitHub:`, err);
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
          owner: "firebase",
          repo: "firebase-android-sdk",
          ref: ref,
          headers: {
            "X-GitHub-Api-Version": "2022-11-28",
          },
          per_page: 100,
        });

    return checkRuns;
  } catch (err) {
    error(`Error fetching check suites on ${ref} from GitHub:`, err);
    throw err;
  }
}

/**
 * Parses the content of a gradle.properties file to extract the version value.
 *
 * @param {string} gradlePropertiesContent The raw content of the
 * gradle.properties file.
 * @return {string} The extracted version value.
 * @throws {Error} If the version value cannot be found within the
 * provided content.
 */
function parseGradlePropertiesForVersion(gradlePropertiesContent) {
  // Split the content by line
  const lines = gradlePropertiesContent.split("\n");

  for (const line of lines) {
    // Trim any whitespace
    const trimmedLine = line.trim();

    // Ignore commented lines
    if (trimmedLine.startsWith("#")) {
      continue;
    }

    // Case-insensitive check if the line starts with 'version'
    if (trimmedLine.toLowerCase().startsWith("version")) {
      const splitLine = trimmedLine.split("=");

      // Ensure the line has an equals sign
      if (splitLine.length < 2) {
        continue;
      }

      // Join any elements after the first equal sign, to handle
      // version numbers with equals sign
      const version = splitLine.slice(1).join("=");

      return version.trim();
    }
  }

  throw new Error("Version not found in gradle.properties");
}

/**
 * Determines the state of a release based on the code freeze date, release
 * date, and completion status of the release.
 *
 * @param {Date} codeFreeze The date on which the code for the release was
 * frozen.
 * @param {Date} release The scheduled release date.
 * @param {boolean} isComplete Indicates whether the release process has been
 * completed.
 * @return {string} The calculated state of the release.
 * @throws {Error} If the release state cannot be determined from the
 * provided parameters.
 */
function calculateReleaseState(codeFreeze, release, isComplete) {
  const now = new Date();

  // Get time difference in milliseconds
  const diffCodeFreeze = codeFreeze.getTime() - now.getTime();
  const diffRelease = release.getTime() - now.getTime();

  // Convert time difference from milliseconds to days
  const diffDaysCodeFreeze = Math.ceil(diffCodeFreeze / (1000 * 60 * 60 * 24));
  const diffDaysRelease = Math.ceil(diffRelease / (1000 * 60 * 60 * 24));

  if (diffDaysCodeFreeze > 2) {
    return RELEASE_STATES.SCHEDULED;
  } else if (diffDaysCodeFreeze <= 2 && diffDaysCodeFreeze > 0) {
    return RELEASE_STATES.UPCOMING;
  } else if (diffDaysCodeFreeze <= 0 && diffDaysRelease > 0) {
    return RELEASE_STATES.CODE_FREEZE;
  } else if (diffDaysCodeFreeze < 0 && diffDaysRelease === 0) {
    return RELEASE_STATES.RELEASE_DAY;
  } else if (diffDaysRelease < 0) {
    return isComplete ? RELEASE_STATES.RELEASED : RELEASE_STATES.DELAYED;
  } else {
    throw new Error("Unable to calculate release state");
  }
}

/**
 * Retrieves release data from the database given a release ID.
 *
 * @param {string} releaseId The ID of the release to fetch.
 * @return {Promise<Object>} A promise that resolves to the release data.
 */
async function getReleaseData(releaseId) {
  const releaseSnapshot = await db.collection("releases")
      .doc(releaseId)
      .get();
  const releaseData = releaseSnapshot.data();
  return releaseData;
}

/**
 * Updates the state of a release in the database.
 *
 * @param {string} releaseId The ID of the release to update.
 * @param {string} state The new state to set for the release.
 * @throws {Error} If the release state update fails.
 */
async function updateReleaseState(releaseId, state) {
  const releaseDoc = db.collection("releases").doc(releaseId);
  const updateData = {state};

  try {
    await releaseDoc.update(updateData);
    log("Release state updated successfully", {releaseId, state});
  } catch (err) {
    error("Failed to update release state", err);
    throw err;
  }
}

/**
 * Fetches and parses release configuration data from a GitHub repository.
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
 * @param {Octokit} octokit The authenticated Octokit client.
 * @param {Object} releaseData The release data containing the branch name.
 * @return {Promise<boolean>} A promise that resolves to the parsed report data.
 */
async function getReleaseReport(octokit, releaseData) {
  const releaseReportJSON = await getRepositoryContent(
      octokit, releaseData.releaseBranchName, "release_report.json",
  );
  const releaseReport = JSON.parse(releaseReportJSON);
  return releaseReport;
}

/**
 * Processes the library names in the release configuration to remove leading
 * colons and replace all other colons with dashes. This is done to avoid
 * complications in JSON strings.
 *
 * @param {Object} releaseConfig The release configuration with the original
 * library names.
 */
function processLibraryNames(releaseConfig) {
  releaseConfig.libraries = releaseConfig.libraries.map((lib) =>
    lib.replace(/^:/, "").replace(/:ktx/g, "/ktx"));
}

/**
 * Extracts the version for each library in the release configuration from the
 * repository
 * and stores them in an object.
 *
 * @param {Octokit} octokit The authenticated Octokit client.
 * @param {Object} releaseData The release data containing the branch name.
 * @param {Object} releaseConfig The release configuration with the processed
 * library names.
 * @return {Promise<Object>} A promise that resolves to an object mapping
 * library names to versions.
 */
async function getLibraryVersions(octokit, releaseData, releaseConfig) {
  const libraryVersions = {};
  for (const library of releaseConfig.libraries) {
    const gradleDir = library.endsWith("/ktx") ?
      library.replace("/ktx", "") : library;

    const gradleProperties = await getRepositoryContent(
        octokit, releaseData.releaseBranchName,
        `${gradleDir}/gradle.properties`,
    );
    const version = parseGradlePropertiesForVersion(gradleProperties);
    libraryVersions[library] = version;
  }
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
          owner: "firebase",
          repo: "firebase-android-sdk",
          branch: releaseBranchName,
          headers: {
            "X-GitHub-Api-Version": "2022-11-28",
          },
        });
  } catch (err) {
    log("release branch does not exist");
    return false;
  }

  return true;
}

/**
 * Creates new library release documents for each version in the libraryVersions
 * object, and deletes any existing library versions associated with the
 * release.
 *
 * @param {Object} libraryVersions Object mapping library names to their
 * versions.
 * @param {string} releaseId The ID of the associated release.
 */
async function createLibraryReleases(libraryVersions, releaseId) {
  // Delete all previous library versions for this release
  const previousLibrariesSnapshot = await db.collection("libraries")
      .where("releaseID", "==", releaseId)
      .get();
  for (const doc of previousLibrariesSnapshot.docs) {
    await db.collection("libraries").doc(doc.id).delete();
  }


  for (const [libraryName, updatedVersion] of Object.entries(libraryVersions)) {
    await db.collection("libraries").add({
      libraryName,
      updatedVersion,
      releaseID: releaseId,
    });
  }
}

/**
 * Creates new change documents for each change in the release report, and
 * deletes any existing changes associated with the release.
 *
 * @param {Object} releaseReport The release report containing changes by
 * library name.
 * @param {string} releaseId The ID of the associated release.
 */
async function createReleaseChanges(releaseReport, releaseId) {
  // Delete all previous changes for this release
  const previousChangesSnapshot = await db.collection("changes")
      .where("releaseID", "==", releaseId)
      .get();
  for (const doc of previousChangesSnapshot.docs) {
    await db.collection("changes").doc(doc.id).delete();
  }

  for (const [libraryName, changes] of
    Object.entries(releaseReport.changesByLibraryName)) {
    // Get the library document from the libraries collection
    const librarySnapshot = await db.collection("libraries")
        .where("libraryName", "==", libraryName)
        .get();

    // If the library does not exist, skip
    if (librarySnapshot.empty) {
      warn("library does not exist", {libraryName});
      continue;
    }

    const libraryId = librarySnapshot.docs[0].id;

    // Write each change to Firestore
    for (const change of changes) {
      await db.collection("changes").add({
        pullRequestName: change.prId,
        pullRequestAuthor: change.author,
        pullRequestID: change.prId,
        pullRequestLink: change.prLink,
        commitID: change.commitId,
        commitLink: change.commitLink,
        libraryID: libraryId,
        releaseID: releaseId,
      });
    }
  }
}


/**
 * Creates new check documents for each check run in the list, and deletes
 * any existing checks associated with the release.
 *
 * @param {Object} checkRunList List of check runs.
 * @param {string} releaseId The ID of the associated release.
 */
async function createChecks(checkRunList, releaseId) {
  // Delete all previous checks for this release
  const previousChecksSnapshot = await db.collection("checks")
      .where("releaseID", "==", releaseId)
      .get();
  for (const doc of previousChecksSnapshot.docs) {
    await db.collection("checks").doc(doc.id).delete();
  }

  for (const checkRun of checkRunList) {
    await db.collection("checks").doc(checkRun.id.toString()).set({
      name: checkRun.name,
      headSHA: checkRun.headSHA,
      status: checkRun.status,
      conclusion: checkRun.conclusion,
      outputTitle: checkRun.outputTitle,
      httpsUrl: checkRun.httpsUrl,
      releaseID: releaseId,
    });
  }
}

/**
 * Syncs the state of a release. This function infers the current state of the
 * release, updates its state in the database, and fetches data from GitHub
 * if the release
 * is not upcoming or scheduled. It also handles possible errors and updates the
 * release state to "error" if an exception is thrown.
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

  log("release data", {releaseData});

  // Infer the state of the release from the collected data
  let releaseState = calculateReleaseState(
      releaseData.codeFreezeDate.toDate(),
      releaseData.releaseDate.toDate(),
      releaseData.isComplete);

  if (releaseState === RELEASE_STATES.UPCOMING ||
    releaseState === RELEASE_STATES.SCHEDULED) {
    // If the release is upcoming or scheduled, we don't need to
    // fetch any data from GitHub, so we can just update the release
    // state and return
    await updateReleaseState(releaseId, releaseState);
    return;
  }

  try {
    // Perform tasks that can be done in parallel
    const [
      releaseBranchExists,
      releaseConfig,
      releaseReport,
    ] = await Promise.all([
      checkReleaseBranchExists(octokit, releaseData.releaseBranchName),
      getReleaseConfig(octokit, releaseData),
      getReleaseReport(octokit, releaseData),
    ]);

    if (!releaseBranchExists) {
      releaseState = RELEASE_STATES.UPCOMING;
      await updateReleaseState(releaseId, releaseState);
      throw new Error("Release branch does not exist");
    }

    // Since the release branch exists, we can fetch data from GitHub
    // to update the release state

    // Process the library names to get correct format
    processLibraryNames(releaseConfig);

    // For each library in the release config, extract the version
    const libraryVersions = await getLibraryVersions(
        octokit, releaseData, releaseConfig);

    log("library versions", {libraryVersions});

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

    log("check run list", {checkRunList});

    // Fetch and create release data in parallel
    await Promise.all([
      createLibraryReleases(libraryVersions, releaseId),
      createReleaseChanges(releaseReport, releaseId),
      createChecks(checkRunList, releaseId),
      // TODO: Fetch build artifact status
    ]);

    // Update release
    await updateReleaseState(releaseId, releaseState, {
      buildArtifactStatus: "", // TODO
      releaseBranchLink: `https://github.com/firebase/firebase-android-sdk/tree/${releaseData.releaseBranchName}`,
    });
  } catch (err) {
    await updateReleaseState(releaseId, RELEASE_STATES.ERROR);
    error("Failed to sync release for a release that has passed code freeze"
        , err);
    throw err;
  }
}

/**
 * Retrieve all the data for all releases from Firestore, and return
 * it as an array of release objects. This function is used to fetch
 * the data for the release dashboard.
 */
exports.getReleaseData = functions.https.onRequest(async (req, res) => {
  const db = admin.firestore();

  try {
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

    log("fetched releases", {releases});
    // Return the complete release data
    res.status(200).json(releases);
  } catch (error) {
    console.error("Failed to get release data:", error);
    res.status(500).send("Failed to get release data");
  }
});

module.exports.validateNewReleases = validateNewReleases;
module.exports.validateNewReleaseStructure = validateNewReleaseStructure;
module.exports.convertDatesToTimestamps = convertDatesToTimestamps;
module.exports.isValidReleaseName = isValidReleaseName;
module.exports.isFutureDate = isFutureDate;
module.exports.getReleaseNumbers = getReleaseNumbers;
module.exports.calculateReleaseState = calculateReleaseState;
module.exports.parseGradlePropertiesForVersion =
parseGradlePropertiesForVersion;
module.exports.processLibraryNames = processLibraryNames;
