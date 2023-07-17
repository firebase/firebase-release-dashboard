const admin = require("firebase-admin");
const db = admin.firestore();
const {Timestamp} = require("firebase-admin/firestore");
const RELEASE_STATES = require("../utils/releaseStates.js");
const {
  validateNewReleaseStructure,
  validateRelease,
} = require("../validation/validation.js");
const {parseCommitTitleFromMessage} = require("../utils/utils.js");
const {REPO_URL} = require("../github/github.js");

/**
 * Retrieve the release ID of the Firestore release document
 * with a given release name.
 *
 * @param {string} releaseName The release name of the release
 * document to fetch.
 * @throws {Error} If there is not exactly one release with the given name.
 * @return {Promise<string>} A promise that resolves to the release ID.
 */
async function getReleaseID(releaseName) {
  const releaseSnapshot = await db.collection("releases")
      .where("releaseName", "==", releaseName)
      .get();

  if (releaseSnapshot.empty) {
    throw new Error(`
      There should only be one release with a given name,
      instead we found ${releaseSnapshot.size} releases with name:
      ${releaseName}
    `);
  }

  if (releaseSnapshot.size > 1) {
    throw new Error(`
      ${releaseSnapshot.size} releases found with name:
      ${releaseName}
    `);
  }

  const releaseId = releaseSnapshot.docs[0].id;

  return releaseId;
}

/**
 * Retrieves release data from the database given a release ID.
 *
 * @param {string} releaseId The ID of the release to fetch.
 * @throws {Error} If there is no release with the given ID.
 * @return {Promise<Object>} A promise that resolves to the release data.
 */
async function getReleaseData(releaseId) {
  const releaseSnapshot = await db.collection("releases")
      .doc(releaseId)
      .get();

  if (!releaseSnapshot.exists) {
    throw new Error(`No release found with ID: ${releaseId}`);
  }

  const releaseData = releaseSnapshot.data();

  return releaseData;
}

/** Retrieve all past releases from Firestore. This includes releases that are
 * currently active.
 *
 * @return {Promise<Array>} Returns a promise that resolves to an array
 * of Firestore document data of past releases.
 * @throws {Error} If there is an error in fetching data from Firestore,
 * the promise is rejected with an error.
 */
async function getPreviousReleaseData() {
  const today = new Date();
  const snapshot = await db.collection("releases")
      .where("releaseDate", "<", today)
      .get();

  const pastReleases = snapshot.docs.map((doc) => doc.data());

  return pastReleases;
}

/** Write new releases to Firestore. This function assumes that the contents
 * of the releases are validated. newReleases is an array of release objects
 * that have the following structure:
 * {
 *   releaseName: string,
 *   releaseOperator: string,
 *   codeFreezeDate: Date,
 *   releaseDate: Date,
 * }
 *
 * @param {Object} newReleases - Releases to store in Firestore
 */
async function addReleases(newReleases) {
  validateNewReleaseStructure(newReleases);

  const batch = db.batch();

  newReleases.forEach((release) => {
    const newReleaseRef = db.collection("releases").doc();
    const snapshotBranchName = `releases/${release.releaseName}`;
    const releaseBranchName = `releases/${release.releaseName}.release`;
    const snapshotBranchLink = `${REPO_URL}/tree/${snapshotBranchName}`;
    const releaseBranchLink = `${REPO_URL}/tree/${releaseBranchName}`;
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
      buildArtifactConclusion: "",
      buildArtifactLink: "",
      buildArtifactJobId: "",
    };
    batch.set(newReleaseRef, releaseData);
  });

  await batch.commit();
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
  const batch = db.batch();

  querySnapshot.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();
}

/**
 * Update a release in Firestore.
 *
 * @param {string} releaseId The ID of the release to update.
 * @param {string} releaseData The new data to set for the release.
 * @throws {Error} If the release state update fails.
 */
async function updateRelease(releaseId, releaseData) {
  validateRelease(releaseData);

  const releaseDoc = db.collection("releases").doc(releaseId);
  await releaseDoc.update(releaseData);
}

/**
 * Updates the state of a release in the database.
 *
 * @param {string} releaseId The ID of the release to update
 * @param {string} newState The new state to set for the release
 * @throws {Error} If the release state update fails, or if the
 * release state is invalid.
 */
async function updateReleaseState(releaseId, newState) {
  const releaseDoc = db.collection("releases").doc(releaseId);
  await releaseDoc.update({state: newState});
}

/**
 * Creates new library release documents for each version in the libraryVersions
 * object, and deletes any existing library versions associated with the
 * release.
 *
 * @param {Object} libraries Object mapping library names to their
 * versions, optedIn and isLockstep flags.
 * @param {string} releaseId The ID of the associated release.
 */
async function updateLibrariesForRelease(libraries, releaseId) {
  const batch = db.batch();

  // Delete all previous library versions for this release
  const previousLibrariesSnapshot = await db.collection("libraries")
      .where("releaseID", "==", releaseId)
      .get();
  previousLibrariesSnapshot.docs.forEach((doc) => {
    const docRef = db.collection("libraries").doc(doc.id);
    batch.delete(docRef);
  });

  // Write each library version to Firestore
  Object.entries(libraries).forEach(
      ([libraryName, {updatedVersion, optedIn, isLockstep}]) => {
        const docRef = db.collection("libraries").doc();
        batch.set(docRef, {
          libraryName,
          updatedVersion,
          optedIn,
          isLockstep,
          releaseID: releaseId,
        });
      });

  await batch.commit();
}


/**
 * Creates new change documents for each change in the release report, and
 * deletes any existing changes associated with the release.
 *
 * @param {Object} releaseReport The release report containing changes by
 * library name.
 * @param {string} releaseId The ID of the associated release.
 * @throws {Error} If a library in the release report does not exist in
 * Firestore.
 */
async function updateChangesForRelease(releaseReport, releaseId) {
  const batch = db.batch();

  // Delete all previous changes for this release
  const previousChangesSnapshot = await db.collection("changes")
      .where("releaseID", "==", releaseId)
      .get();
  for (const doc of previousChangesSnapshot.docs) {
    const docRef = db.collection("changes").doc(doc.id);
    batch.delete(docRef);
  }

  const changePromises = Object.entries(releaseReport.changesByLibraryName)
      .map(async ([libraryName, changes]) => {
        // Get the library document from the libraries collection
        const librarySnapshot = await db.collection("libraries")
            .where("libraryName", "==", libraryName)
            .get();

        // Every library in the release report should already exist in Firestore
        if (librarySnapshot.empty) {
          throw new Error("Library in release report does not exist"+
          " in Firestore: " + libraryName);
        }

        const libraryId = librarySnapshot.docs[0].id;

        changes.forEach((change) => {
          const docRef = db.collection("changes").doc(change.commitId);
          batch.set(docRef, {
            commitTitle: parseCommitTitleFromMessage(change.message),
            message: change.message,
            author: "GitHub user", // change.author
            pullRequestID: change.prId,
            pullRequestLink: change.prLink,
            commitID: change.commitId,
            commitLink: change.commitLink,
            libraryID: libraryId,
            releaseID: releaseId,
          });
        });
      });

  await Promise.all(changePromises);
  await batch.commit();
}


/**
 * Creates new check documents for each check run in the list, and deletes
 * any existing checks associated with the release.
 *
 * @param {Object} checkRunList List of check runs.
 * @param {string} releaseId The ID of the associated release.
 */
async function updateChecksForRelease(checkRunList, releaseId) {
  const batch = db.batch();

  // Delete all previous checks for this release
  const previousChecksSnapshot = await db.collection("checks")
      .where("releaseID", "==", releaseId)
      .get();
  previousChecksSnapshot.docs.forEach((doc) => {
    const docRef = db.collection("checks").doc(doc.id);
    batch.delete(docRef);
  });

  // Write each check to Firestore
  checkRunList.forEach((checkRun) => {
    const docRef = db.collection("checks").doc(checkRun.id.toString());
    batch.set(docRef, {
      name: checkRun.name,
      headSHA: checkRun.headSHA,
      status: checkRun.status,
      conclusion: checkRun.conclusion,
      outputTitle: checkRun.outputTitle,
      httpsUrl: checkRun.httpsUrl,
      releaseID: releaseId,
    });
  });

  await batch.commit();
}

module.exports = {
  getPreviousReleaseData,
  addReleases,
  deleteUpcomingReleases,
  getReleaseID,
  updateRelease,
  updateReleaseState,
  updateLibrariesForRelease,
  updateChangesForRelease,
  updateChecksForRelease,
  getReleaseData,
};
