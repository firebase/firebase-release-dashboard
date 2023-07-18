const ERRORS = {
  NO_RELEASES: "There are no releases",
  CODEFREEZE_AFTER_RELEASE: "The release has a code freeze date that is after"+
  " the release date",
  MISSING_RELEASE_FIELD: "There is a required release field that is missing",
  INVALID_RELEASE_FIELD: "There is a required release field that is in an"+
  " invalid format",
  INVALID_RELEASE_NAME: "There is a release with an invalid release name",
  NON_MONOTONIC_RELEASE_NUMBER: "Release number is not one more than the " +
  "previous release number",
  INVALID_DATE: "There is a date that is invalid",
  RELEASE_OVERLAP: "There are releases with overlapping dates",
  DUPLICATE_RELEASE_NAMES: "There are releases with duplicate names",
};

module.exports = ERRORS;
