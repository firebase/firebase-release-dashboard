// Regular expressions
const REGEX = {
  // This regular expression captures the version number from a file, ignoring
  // commented lines. It assumes the version is denoted by 'version=...'
  // at the start of a line, possibly surrounded by white spaces. The version
  // number can include numeric parts, dots and an optional alphanumeric
  // suffix like '-beta09'.
  // eslint-disable-next-line max-len
  EXTRACT_VERSION_FROM_GRADLEPROPERTIES: /^(?:#[^\n]*\n\s*)*^\s*version\s*=\s*([\d.]+(?:-\S*[a-zA-Z][\d]+)?)/mi,
  // This regular expression captures the title of commit from a string that
  // contains the raw commit message. Raw commit messages include the PR number
  // (e.g. (#1234) at the end of the title, and has following lines for the
  // body, which could include squashed commit titles.
  EXTRACT_COMMIT_TITLE_FROM_MESSAGE: /(.+)(?=\s\(#[0-9]+\)\n)/,
  // This regular expression matches a valid release name. Valid release names
  // are of the form "M<releaseNumber>".
  RELEASE_NAME: /^M\d+\S*$/,
  // This regular expression matches slashes.
  SLASH: /\//g,
};

module.exports = REGEX;

