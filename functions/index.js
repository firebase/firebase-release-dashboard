// The Cloud Functions for the Firebase SDK to create Cloud Functions and
// triggers.
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const {initializeApp} = require("firebase-admin/app");
initializeApp({
  credential: admin.credential.applicationDefault(),
});
const {Timestamp} = require("firebase-admin/firestore");
const db = admin.firestore();
const {
  log,
  info,
  warn,
  error,
} = require("firebase-functions/logger");

const ERRORS = require("./utils/errors");
const RELEASE_STATES = require("./releaseStates");

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
      const releaseData = {
        state: RELEASE_STATES.SCHEDULED,
        releaseName: release.releaseName,
        releaseOperator: release.releaseOperator,
        codeFreezeDate: release.codeFreezeDate,
        releaseDate: release.releaseDate,
        snapshotBranchName: "", // These fields will be filled in later
        snapshotBranchLink: "",
        releaseBranchName: "",
        releaseBranchLink: "",
        releaseBranchStatusLink: "",
        isComplete: false,
        workflowStatus: "",
        workflowLink: "",
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

  try {
    // Verify the format of the releases
    const newReleases = req.body.releases;
    try {
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
    await deleteUpcomingReleases();
    info("Deleted all upcoming releases in Firestore");

    // Write the updated upcoming releases to Firestore
    try {
      // Convert the new releases JSON to a format that is able
      // to be stored in Firestore. We only need to change the string
      // timestamps to Firestore timestamps.
      const releasesWithConvertedDates =
        convertDatesToTimestamps(newReleases);

      await addReleases(releasesWithConvertedDates);
      info("Releases scheduled sucessfully",
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

module.exports.validateNewReleases = validateNewReleases;
module.exports.validateNewReleaseStructure = validateNewReleaseStructure;
module.exports.convertDatesToTimestamps = convertDatesToTimestamps;
module.exports.isValidReleaseName = isValidReleaseName;
module.exports.isFutureDate = isFutureDate;
module.exports.getReleaseNumbers = getReleaseNumbers;
