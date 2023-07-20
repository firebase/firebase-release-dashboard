const admin = require("firebase-admin");
const db = admin.firestore();
const {Timestamp} = require("firebase-admin/firestore");
const RELEASE_STATES = require("../utils/releaseStates.js");
const {
  validateNewReleasesStructure,
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
 * @throws {Error} If there is more than one release with a given name.
 * @return {Promise<string|null>} A promise that resolves to the release ID,
 * or null if no release was found.
 */
async function getReleaseID(releaseName) {
  const releaseSnapshot = await db.collection("releases")
      .where("releaseName", "==", releaseName)
      .get();

  if (releaseSnapshot.empty) {
    return null;
  }

  if (releaseSnapshot.size > 1) {
    throw new Error(
        `There should be at most one release with name: ${releaseName},
      instead ${releaseSnapshot.size} were releases found.`,
    );
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

/**
 * Prepare a single release object for storage into Firestore.
 *
 * @param {Object} release - A release object
 * @return {Object} - A release data object ready for storage
 */
function releaseToFirestoreObject(release) {
  const snapshotBranchName = `releases/${release.releaseName}`;
  const releaseBranchName = `releases/${release.releaseName}.release`;
  const snapshotBranchLink = `${REPO_URL}/tree/${snapshotBranchName}`;
  const releaseBranchLink = `${REPO_URL}/tree/${releaseBranchName}`;

  return {
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
}

/**
 * Set a release object into Firestore batch for further processing.
 *
 *
 * Note that this will not commit the change, it merely adds it to
 * the given batch.
 *
 * @param {admin.firestore.WriteBatch} batch - The Firestore batch instance
 * @param {Object} release - A release object
 */
function batchSetRelease(batch, release) {
  const newReleaseRef = db.collection("releases").doc();
  const releaseData = releaseToFirestoreObject(release);
  batch.set(newReleaseRef, releaseData);
}

/**
 * Write new releases to Firestore.
 *
 * Assumes that the contents of the releases are validated. newReleases is
 * an array of release objects that have the following structure:
 * {
 *   releaseName: string,
 *   releaseOperator: string,
 *   codeFreezeDate: Date,
 *   releaseDate: Date,
 * }
 *
 * @param {Object} newReleases - Releases to store in Firestore
 */
async function setReleases(newReleases) {
  validateNewReleasesStructure(newReleases);

  const batch = db.batch();

  newReleases.forEach((release) => batchSetRelease(batch, release));

  await batch.commit();
}
/**
 * Delete the releases in Firestore with code freeze dates that are in the
 * future.
 *
 * This is intented to be used when scheduling new upcoming releases,
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
 * Deletes all existing library documents associated with a release.
 *
 * Note that this will not commit the change, it merely adds it to
 * the given batch.
 *
 * @param {admin.firestore.WriteBatch} batch The batch to add the
 * delete operations to.
 * @param {string} releaseId
 */
async function batchDeleteReleaseLibraries(batch, releaseId) {
  const previousLibrariesSnapshot = await db.collection("libraries")
      .where("releaseID", "==", releaseId)
      .get();
  previousLibrariesSnapshot.docs.forEach((doc) => {
    const docRef = db.collection("libraries").doc(doc.id);
    batch.delete(docRef);
  });
}

/**
 * Adds new library release documents to Firestore batch.
 *
 * Note that this will not commit the change, it merely adds it to
 * the given batch.
 *
 * @param {admin.firestore.WriteBatch} batch The batch to add the
 * set operations to.
 * @param {Object} libraries Object mapping library names to their
 * versions, optedIn and isLockstep flags.
 * @param {string} releaseId The ID of the associated release.
 */
function batchSetLibrariesForRelease(batch, libraries, releaseId) {
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

  await batchDeleteReleaseLibraries(batch, releaseId);
  batchSetLibrariesForRelease(batch, libraries, releaseId);

  await batch.commit();
}

/**
 * Retrieve the library ID of the Firestore library document
 *
 * @param {string} libraryName The name of the library to fetch.
 * @throws {Error} If there is no library with the given name.
 * @return {Promise<string>} A promise that resolves to the library ID.
 */
async function getLibraryId(libraryName) {
  const librarySnapshot = await db.collection("libraries")
      .where("libraryName", "==", libraryName)
      .get();

  if (librarySnapshot.empty) {
    throw new Error(`
      Library in release report does not exist in Firestore: ${libraryName}`,
    );
  }

  return librarySnapshot.docs[0].id;
}

/**
 * Deletes all existing change documents associated with a release.
 *
 * Note that this will not commit the change, it merely adds it to
 * the given batch.
 *
 * @param {admin.firestore.WriteBatch} batch The batch to add the
 * delete operations to.
 * @param {string} releaseId The ID of the associated release.
 */
async function batchDeleteReleaseChanges(batch, releaseId) {
  const previousChangesSnapshot = await db.collection("changes")
      .where("releaseID", "==", releaseId)
      .get();
  for (const doc of previousChangesSnapshot.docs) {
    const docRef = db.collection("changes").doc(doc.id);
    batch.delete(docRef);
  }
}

/**
 * Creates new change documents for a library and release.
 *
 * Note that this will not commit the change, it merely adds it to
 * the given batch.
 *
 * @param {admin.firestore.WriteBatch} batch The batch to add the
 * delete operations to.
 * @param {Object} changes The changes to add to Firestore.
 * @param {string} libraryId The ID of the associated library.
 * @param {string} releaseId The ID of the associated release.
 */
function batchSetReleaseChanges(batch, changes, libraryId, releaseId) {
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
}

/**
 * Creates new change documents for each change in the release report, and
 * deletes any existing changes associated with the release.
 *
 * @param {Object} releaseReport The release report containing changes by
 * library name. The structure of the release report can be found at
 * https://github.com/firebase/firebase-android-sdk/pull/5077#issuecomment-1591661163
 * @param {string} releaseId The ID of the associated release.
 * @throws {Error} If a library in the release report does not exist in
 * Firestore.
 */
async function updateChangesForRelease(releaseReport, releaseId) {
  const batch = db.batch();

  await batchDeleteReleaseChanges(batch, releaseId);

  const libraryNames = Object.keys(releaseReport.changesByLibraryName);
  for (const libraryName of libraryNames) {
    const changes = releaseReport.changesByLibraryName[libraryName];
    const libraryId = await getLibraryId(libraryName);
    batchSetReleaseChanges(batch, changes, libraryId, releaseId);
  }

  await batch.commit();
}


/**
 * Deletes all existing check documents associated with a release.
 *
 * Note that this will not commit the change, it merely adds it to
 * the given batch.
 *
 * @param {admin.firestore.WriteBatch} batch The batch to add the
 * delete operations to.
 * @param {string} releaseId The ID of the associated release.
 */
async function batchDeleteReleaseChecks(batch, releaseId) {
  const previousChecksSnapshot = await db.collection("checks")
      .where("releaseID", "==", releaseId)
      .get();
  previousChecksSnapshot.docs.forEach((doc) => {
    const docRef = db.collection("checks").doc(doc.id);
    batch.delete(docRef);
  });
}

/**
 * Adds new check documents to Firestore batch.
 *
 * Note that this will not commit the change, it merely adds it to
 * the given batch.
 *
 * @param {admin.firestore.WriteBatch} batch The batch to add the
 * set operations to.
 * @param {Object} checkRunList List of check runs.
 * @param {string} releaseId The ID of the associated release.
 */
function batchSetReleaseChecks(batch, checkRunList, releaseId) {
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

  await batchDeleteReleaseChecks(batch, releaseId);
  batchSetReleaseChecks(batch, checkRunList, releaseId);

  await batch.commit();
}

module.exports = {
  setReleases,
  deleteUpcomingReleases,
  getReleaseID,
  updateRelease,
  updateReleaseState,
  updateLibrariesForRelease,
  updateChangesForRelease,
  updateChecksForRelease,
  getReleaseData,
};
