const {Timestamp} = require("firebase-admin/firestore");
const {error} = require("firebase-functions/logger");
const REGEX = require("./regex.js");
const RELEASE_STATES = require("./releaseStates.js");

/**
 * Convert release dates from strings to Firestore Timestamps.
 *
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
            error(`Invalid date string format for ${dateType}:`+`
              ${release[dateType]}`);
            throw new Error(`Invalid date string format for`+
              `${dateType}: ${release[dateType]}`);
          }
        } catch (err) {
          error(`Error converting ${dateType} to Firestore Timestamp:`,
              {error: err.message});
          throw err;
        }
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
 * commit messages in the GitHub master branch. This function parses the
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

module.exports = {
  convertDatesToTimestamps,
  parseGradlePropertiesForVersion,
  calculateReleaseState,
  processLibraryNames,
  parseCommitTitleFromMessage,
};
