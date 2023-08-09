const {Timestamp} = require("firebase-admin/firestore");
const {error} = require("firebase-functions/logger");
const REGEX = require("./regex.js");
const RELEASE_STATES = require("./releaseStates.js");

/**
 * Converts a date string into a Firestore Timestamp.
 *
 * @param {string} dateString - The date string to convert.
 * @return {Timestamp} The Firestore Timestamp object.
 */
function convertDateToTimestamp(dateString) {
  try {
    // Attempt to parse the date string and convert to Firestore Timestamp
    const dateObject = new Date(dateString);
    if (!isNaN(dateObject)) {
      return Timestamp.fromDate(dateObject);
    } else {
      error("Invalid date string format", {dateString: dateString});
      throw new Error(`Invalid date string format: ${dateString}`);
    }
  } catch (err) {
    error("Error converting to Firestore Timestamp", {error: err.message});
    throw err;
  }
}

/**
 * Convert release dates from strings to Firestore Timestamps.
 *
 * @param {Object[]} releases - The releases to convert.
 * @return {Object[]} The releases with converted dates.
 */
function convertReleaseDatesToTimestamps(releases) {
  return releases.map((release) => {
    const convertedRelease = {...release};
    ["codeFreezeDate", "releaseDate"].forEach((dateType) => {
      if (release[dateType]) {
        convertedRelease[dateType] = convertDateToTimestamp(release[dateType]);
      }
    });
    return convertedRelease;
  });
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

  if (diffDaysCodeFreeze > 0) {
    return RELEASE_STATES.SCHEDULED;
  } else if (diffDaysCodeFreeze <= 0 && diffDaysRelease > 0) {
    return RELEASE_STATES.CODE_FREEZE;
  } else if (diffDaysCodeFreeze < 0 && diffDaysRelease === 0) {
    return RELEASE_STATES.RELEASE_DAY;
  } else if (diffDaysRelease < 0) {
    return isComplete ? RELEASE_STATES.RELEASED : RELEASE_STATES.DELAYED;
  } else {
    throw new Error(`Unable to calculate release state between 
    ${codeFreeze} and ${release} dates`);
  }
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
 * Parses the content of a gradle.properties file to extract the version value.
 *
 * @param {string} gradlePropertiesContent The raw content of the
 * gradle.properties file.
 * @return {string} The extracted version value.
 * @throws {Error} If the version value cannot be found within the
 * provided content.
 */
function parseGradlePropertiesForVersion(gradlePropertiesContent) {
  let match;
  if ((match = REGEX.EXTRACT_VERSION_FROM_GRADLEPROPERTIES
      .exec(gradlePropertiesContent)) !== null) {
    if (match[1]) {
      return match[1];
    }
  }

  throw new Error(`Unable to extract version from gradle.properties: 
  ${gradlePropertiesContent}`);
}

/**
 * Change messages that are retrieved from release reports are the exact
 * commit messages in the GitHub master branch. Parses the
 * commit message to extract the title of the commit, which is the first line
 * of the commit message, before the pull request number.
 *
 * @param {string} message
 * @return {string} The parsed commit title.
 */
function parseCommitTitleFromMessage(message) {
  let match;
  if ((match = REGEX.EXTRACT_COMMIT_TITLE_FROM_MESSAGE
      .exec(message)) !== null) {
    if (match[1]) {
      return match[1];
    }
  }

  throw new Error(`Unable to extract commit title from message: ${message}`);
}

/**
 * Gets the set of commit IDs from changes.
 *
 * @param {Map<string, Array<Object>>} libraryChanges Map of library names
 * to changes.
 * @return {Set<string>} The set of commit IDs from the release report.
 */
function getCommitIdsFromChanges(libraryChanges) {
  const commitIds = new Set();
  const libraryNames = Object.keys(libraryChanges);
  for (const libraryName of libraryNames) {
    const changes = libraryChanges[libraryName];
    changes.forEach((change) => commitIds.add(change.commitId));
  }
  return commitIds;
}

/**
 * Merges '/ktx' submodules data into root libraries.
 *
 * @param {Object} libraryData - The object containing library data, where each
 * key is a library name, and the value is an array of changes.
 * @return {Object} The updated library data with '/ktx' changes merged
 * into root libraries and '/ktx' entries removed.
 */
function mergeKtxIntoRoot(libraryData) {
  for (const key in libraryData) {
    if (key.includes("/ktx")) {
      const rootKey = key.split("/")[0];

      // If the root library exists, merge the '/ktx' data into it
      // otherwise, create a new root library with the '/ktx' data
      if (libraryData[rootKey]) {
        libraryData[rootKey] = [...libraryData[rootKey], ...libraryData[key]];
      } else {
        libraryData[rootKey] = libraryData[key];
      }

      // Remove the '/ktx' library from the object
      delete libraryData[key];
    }
  }

  return libraryData;
}

/**
 * Filters out '/ktx' submodules from an array of library names.
 *
 * @param {Array} libaries - The array containing library names.
 * @return {Array} The updated array of library names without any '/ktx'
 * submodules.
 */
function filterOutKtx(libaries) {
  return libaries.filter((library) => !library.includes("/ktx"));
}

/**
 * Gets the stack trace from an error.
 *
 * @param {Error} error - The error to get the stack trace from.
 * @throws {Error} If the provided argument is not an Error object.
 * @return {string} The stack trace.
 */
function getStackTrace(error) {
  if (!(error instanceof Error)) {
    throw new Error(
        `Provided argument is not an Error object: ${error}}`,
    );
  }

  return error.stack.trim();
}

module.exports = {
  convertDateToTimestamp,
  convertReleaseDatesToTimestamps,
  parseGradlePropertiesForVersion,
  calculateReleaseState,
  processLibraryNames,
  parseCommitTitleFromMessage,
  mergeKtxIntoRoot,
  filterOutKtx,
  getCommitIdsFromChanges,
  getStackTrace,
};
