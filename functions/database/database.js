const admin = require("firebase-admin");
const db = admin.firestore();
const RELEASE_STATES = require("../utils/releaseStates.js");
const {
  validateNewReleasesStructure,
  validateRelease,
} = require("../validation/validation.js");
const {
  parseCommitTitleFromMessage,
  getCommitIdsFromChanges,
} = require("../utils/utils.js");
const {REPO_URL} = require("../github/github.js");
const {warn} = require("firebase-functions/logger");
const {Timestamp} = require("firebase-admin/firestore");
const REGEX = require("../utils/regex.js");

/**
 * Check if a release document with a given releaseId exists in Firestore.
 *
 * @param {string} releaseId - The ID of the release to check
 * @return {Promise<boolean>} - A promise that resolves to true if the
 * release exists, false otherwise.
 */
async function releaseExists(releaseId) {
  const releaseSnapshot = await db.collection("releases")
      .doc(releaseId)
      .get();

  return releaseSnapshot.exists;
}

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
 * Retrieve the release ID of the Firestore release document
 * with a given release branch.
 *
 * @param {string} releaseBranchName The release branch name of the release
 * document to fetch.
 * @return {Promise<string|null>} A promise that resolves to the release ID,
 * or null if no release was found.
 */
async function getReleaseIdFromBranch(releaseBranchName) {
  const releaseSnapshot = await db.collection("releases")
      .where("releaseBranchName", "==", releaseBranchName)
      .get();

  if (releaseSnapshot.empty) {
    return null;
  }

  if (releaseSnapshot.size > 1) {
    warn("There should only be only one release that tracks a branch",
        {
          releaseBranchName: releaseBranchName,
          numBranches: releaseSnapshot.size,
          releaseSnapshot: releaseSnapshot.docs.map((doc) => doc.data()),
        },
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
  return {
    state: RELEASE_STATES.SCHEDULED, // Temporary state until release is synced
    releaseName: release.releaseName,
    releaseOperator: "ACore Team Member", // release.releaseOperator,
    codeFreezeDate: release.codeFreezeDate,
    releaseDate: release.releaseDate,
    releaseBranchName: release.releaseBranchName,
    releaseBranchLink: `${REPO_URL}/tree/${release.releaseBranchName}`,
    isReleased: release.isReleased,
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
 * Since Firestore documents can't have '/' in their IDs, we need to
 * encode the library name and version into a unique ID that does
 * not have that character.
 *
 * @param {string} libraryName
 * @param {string} updatedVersion
 * @return {string} The ID of the library document.
 */
function encodeLibraryDocId(libraryName, updatedVersion) {
  const encodedLibraryName = libraryName.replace(REGEX.SLASH, ":");
  return `${encodedLibraryName}-${updatedVersion}`;
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
 * versions, optedIn and libraryGroupRelease flags.
 * @param {string} releaseId The ID of the associated release.
 */
function batchSetLibrariesForRelease(batch, libraries, releaseId) {
  Object.entries(libraries).forEach(
      ([libraryName, {updatedVersion, optedIn, libraryGroupRelease}]) => {
        const uniqueId = encodeLibraryDocId(libraryName, updatedVersion);
        const docRef = db.collection("libraries").doc(uniqueId);
        batch.set(docRef, {
          libraryName,
          updatedVersion,
          optedIn,
          libraryGroupRelease,
          releaseID: releaseId,
        });
      });
}

/**
 * Deletes all existing library documents associated with a release that
 * are no longer in the release. This only happens when a library
 * is opted out from a release.
 *
 * @param {admin.firestore.WriteBatch} batch The batch to add the
 * delete operations to.
 * @param {Object} libraries Object mapping library names to their
 * versions, optedIn and libraryGroupRelease flags.
 * @param {string} releaseId The ID of the associated release.
 */
async function batchDeleteOptedOutLibraries(batch, libraries, releaseId) {
  // Delete all libraries that are no longer in our set of libraries
  const libraryNames = Object.keys(libraries);
  const previousLibrariesSnapshot = await db.collection("libraries")
      .where("releaseID", "==", releaseId)
      .get();

  previousLibrariesSnapshot.docs.forEach((doc) => {
    if (!libraryNames.includes(doc.data().libraryName)) {
      const docRef = db.collection("libraries").doc(doc.id);
      batch.delete(docRef);
    }
  });
}

/**
 * Creates new library release documents for each version in the libraryVersions
 * object, and deletes any libraries that were opted out from the release
 *
 * @param {admin.firestore.WriteBatch} libraries The batch to add the
 * delete operations to.
 * @param {string} releaseId
 */
async function updateLibrariesForRelease(libraries, releaseId) {
  const batch = db.batch();

  batchSetLibrariesForRelease(batch, libraries, releaseId);
  await batchDeleteOptedOutLibraries(batch, libraries, releaseId);

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
 * Deletes all existing change documents associated with a release that
 * are no longer in the release.
 *
 * @param {admin.firestore.WriteBatch} batch The batch to add the
 * delete operations to.
 * @param {Map<string, Array<Object>>} newChanges Map of library names
 * to new changes.
 * @param {string} releaseId The ID of the associated release.
 * @throws {Error} If a library in the release report does not exist in
 * Firestore.
 */
async function batchDeleteOldChanges(batch, newChanges, releaseId) {
  const previousChangesSnapshot = await db.collection("changes")
      .where("releaseID", "==", releaseId)
      .get();

  const commitIds = getCommitIdsFromChanges(newChanges);

  previousChangesSnapshot.docs.forEach((doc) => {
    if (!commitIds.has(doc.data().commitID)) {
      const docRef = db.collection("changes").doc(doc.id);
      batch.delete(docRef);
    }
  });
}

/**
 * Creates new change documents for each change in the release report, and
 * deletes any existing changes associated with the release.
 *
 * @param {Map<string, Array<Object>>} libraryChanges Map of library names
 * to changes.
 * @param {string} releaseId The ID of the associated release.
 * @throws {Error} If a library in the release report does not exist in
 * Firestore.
 */
async function updateChangesForRelease(libraryChanges, releaseId) {
  const batch = db.batch();

  // Delete the changes that are no longer in the release report
  await batchDeleteOldChanges(batch, libraryChanges, releaseId);

  const libraryNames = Object.keys(libraryChanges);
  for (const libraryName of libraryNames) {
    const changes = libraryChanges[libraryName];
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

/**
  * Update a check run in Firestore.
  *
  * This function is not to be used for creating new check runs.
  * Because of this, it does not set fields that are static.
  *
  * @param {string} checkRunId The ID of the check run to update.
  * @param {string} headSHA The SHA of the commit that the check run
  * is associated with.
  * @param {string} status The status of the check run.
  * @param {string} conclusion The conclusion of the check run.
  * @throws {Error} If the check run does not exist in Firestore.
  * @return {Promise<void>} A promise that resolves when the check run
  * has been updated.
  */
async function updateCheckRunStatus(checkRunId, headSHA, status, conclusion) {
  const docRef = db.collection("checks").doc(checkRunId);
  await docRef.set({
    headSHA: headSHA,
    status: status,
    conclusion: conclusion,
  });
}

/**
 * Deletes all data associated with a release.
 *
 * @param {string} releaseId The ID of the release to delete.
 * @return {Promise<void>} A promise that resolves when the release
 * data has been deleted.
 */
async function deleteAllReleaseData(releaseId) {
  const batch = db.batch();

  // Delete all the data associated with the release
  await batchDeleteReleaseLibraries(batch, releaseId);
  await batchDeleteReleaseChanges(batch, releaseId);
  await batchDeleteReleaseChecks(batch, releaseId);

  // Delete the release itself
  const releaseDoc = db.collection("releases").doc(releaseId);
  batch.delete(releaseDoc);

  await batch.commit();
}

/**
 * Stores a stack trace in Firestore.
 *
 * @param {string} releaseId The ID of the release to store the stack trace for.
 * @param {string} errorMsg The error message to store.
 * @param {string} stackTrace The stack trace to store.
 * @param {string} contextMsg Context surrounding the error.
 */
async function setReleaseError(releaseId, errorMsg, stackTrace, contextMsg) {
  const timestamp = Timestamp.now();

  await db.collection("releaseError").add({
    releaseID: releaseId,
    stackTrace: stackTrace,
    contextMsg: contextMsg,
    timestamp: timestamp,
  });
}

module.exports = {
  releaseExists,
  setReleases,
  getReleaseID,
  getReleaseIdFromBranch,
  updateRelease,
  updateReleaseState,
  updateLibrariesForRelease,
  updateChangesForRelease,
  updateChecksForRelease,
  getReleaseData,
  updateCheckRunStatus,
  deleteAllReleaseData,
  setReleaseError,
};
