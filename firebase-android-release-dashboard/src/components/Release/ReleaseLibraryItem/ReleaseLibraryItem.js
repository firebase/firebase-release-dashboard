import React from "react";
import PropTypes from "prop-types";
import {Link, Typography, Paper} from "@material-ui/core";
import {Alert, AlertTitle} from "@material-ui/lab";
import {GitCommitIcon} from "@primer/octicons-react";
import useStyles from "./styles";
import useChanges from "../../../hooks/useChanges";

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
  const encodedLibraryName = libraryName.replace(/\//g, ":");
  return `${encodedLibraryName}-${updatedVersion}`;
}

/**
 * Represents a single library item in a release.
 *
 * @param {Object} library - The library details.
 * @param {String} library.id - The ID of the library.
 * @param {String} library.libraryName - The name of the library.
 * @param {String} library.updatedVersion - The updated version of the
 * library.
 * @param {Boolean} library.optedIn - Whether the library was manually
 * opted into the release.
 * @param {Boolean} library.libraryGroupRelease - Whether the library
 * was included to keep version alignment with other libraries.
 * @return {JSX.Element} The ReleaseLibraryItem component.
 */
function ReleaseLibraryItem({library}) {
  const classes = useStyles();

  const libraryId = encodeLibraryDocId(
      library.libraryName, library.updatedVersion);
  const changes = useChanges(libraryId);

  const {
    libraryName,
    updatedVersion,
    optedIn,
    libraryGroupRelease,
  } = library;

  return (
    <Paper elevation={0} className={classes.libraryPaper}>
      <Typography
        variant="subtitle1"
        color="textPrimary"
        className={classes.libraryName}
      >
        {`${libraryName} ${updatedVersion}`}
      </Typography>
      {optedIn ? (
        <Alert severity="info">
          <AlertTitle variant="body2">Manually Opted In</AlertTitle>
          This library was manually opted in to the release by the
          release operator.
        </Alert>
      ) : libraryGroupRelease ? (
        <Alert severity="info">
          <AlertTitle variant="body2">Library Group Release</AlertTitle>
          This library was included in the release to ensure
          its version stays aligned with other libraries.
        </Alert>
      ) : (
        changes.map(
            ({commitLink, commitTitle,
              pullRequestLink, pullRequestID}, index) => (
              <Typography variant="body2" color="textPrimary" key={index}>
                <Link href={commitLink} target="_blank" rel="noreferrer">
                  <GitCommitIcon className={classes.icon} size={16} />
                </Link>
                {commitTitle}
            (
                <Link
                  href={pullRequestLink}
                  target="_blank"
                  rel="noreferrer"
                >
              #{pullRequestID}
                </Link>
            )
              </Typography>
            ))
      )}
    </Paper>
  );
}

ReleaseLibraryItem.propTypes = {
  library: PropTypes.shape({
    id: PropTypes.string.isRequired,
    libraryName: PropTypes.string.isRequired,
    updatedVersion: PropTypes.string.isRequired,
    optedIn: PropTypes.bool.isRequired,
    libraryGroupRelease: PropTypes.bool.isRequired,
  }).isRequired,
};

export default ReleaseLibraryItem;
