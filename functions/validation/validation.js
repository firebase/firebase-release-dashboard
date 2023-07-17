const {Timestamp} = require("firebase-admin/firestore");
const ERRORS = require("../utils/errors.js");
const REGEX = require("../utils/regex.js");

/**
 * Helper function to check the release name format.
 * The format of release names must be "M<releaseNumber>"
 *
 * @param {string} name - The release name.
 * @return {bool} - True if the release name is valid.
 */
function isValidReleaseName(name) {
  return REGEX.RELEASE_NAME.test(name);
}

/** Helper function to check that a string represents a valid date.
 *
 * @param {string} dateString - A date in string format.
 * @return {bool} - True if the string is a valid date.
 */
function isValidDate(dateString) {
  if (typeof dateString !== "string") {
    return false;
  }
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}


/**
 * Validates that the release name is in the correct format.
 *
 * @param {Object} release - The release to validate.
 * @return {Array} errors - A list of errors from the validation of the release
 * name.
 */
function validateReleaseName(release) {
  const errors = [];

  if (!release.releaseName) {
    errors.push({
      message: ERRORS.MISSING_RELEASE_FIELD,
      offendingRelease: release,
    });
  } else if (typeof release.releaseName != "string" ||
      release.releaseName.trim() === "") {
    errors.push({
      message: ERRORS.INVALID_RELEASE_FIELD,
      offendingRelease: release,
    });
  } else if (!isValidReleaseName(release.releaseName)) {
    errors.push({
      message: ERRORS.INVALID_RELEASE_NAME,
      offendingRelease: release,
    });
  }

  return errors;
}

/**
 * Validates that the release operator is in the correct format.
 *
 * @param {Object} release - The release to validate.
 * @return {Array} errors - A list of errors from the validation of the release
 * operator.
 */
function validateReleaseOperator(release) {
  const errors = [];

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

  return errors;
}

/**
 * Validates that the release dates are in the correct order.
 *
 * @param {Object} release - The release to validate.
 * @return {Array} errors - A list of errors from the validation of the release
 * dates.
 */
function validateReleaseDates(release) {
  const errors = [];

  if (!release.codeFreezeDate || !release.releaseDate) {
    errors.push({
      message: ERRORS.MISSING_RELEASE_FIELD,
      offendingRelease: release,
    });
  } else if (!isValidDate(release.codeFreezeDate) ||
      !isValidDate(release.releaseDate)) {
    errors.push({
      message: ERRORS.INVALID_DATE,
      offendingRelease: release,
    });
  } else if (new Date(release.releaseDate) <=
    new Date(release.codeFreezeDate)) {
    errors.push({
      message: ERRORS.CODEFREEZE_AFTER_RELEASE,
      offendingRelease: release,
    });
  }

  return errors;
}

/**
 * Validates that a release object is in a valid form.
 *
 * @param {Object} release - The release to validate.
 * @return {Array} errors - A list of errors from the validation of the release.
 */
function validateRelease(release) {
  const releaseNameErrors = validateReleaseName(release);
  const operatorErrors = validateReleaseOperator(release);
  const dateErrors = validateReleaseDates(release);

  return [...releaseNameErrors, ...operatorErrors, ...dateErrors];
}

/** Validation checks for a set of upcoming releases. This function is only
   * intended to be used to validate releases that are to be scheduled, and not
   * already existing releases.
   *
   * @param {Object} newReleases - A set of upcoming releases to be validated
   * @return {Object} list of errors from the validation of the releases.
   */
function validateNewReleases(newReleases) {
  const errors = [];

  // Validate that there are releases
  if (!newReleases) {
    errors.push({
      message: ERRORS.NO_RELEASES,
    });
    return errors;
  }

  for (const release of newReleases) {
    const releaseErrors = validateRelease(release);
    errors.push(...releaseErrors);
  }

  return errors;
}

/**
 * Validates new releases before they are stored in Firestore.
 * This is primarily to ensure the date format is held, and not to ensure
 * that any logical errors don't exist in the code.
 *
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

module.exports = {
  isValidReleaseName,
  isValidDate,
  validateRelease,
  validateNewReleases,
  validateNewReleaseStructure,
};
