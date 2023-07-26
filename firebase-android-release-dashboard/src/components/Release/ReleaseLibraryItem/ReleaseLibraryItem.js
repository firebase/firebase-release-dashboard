import React from "react";
import PropTypes from "prop-types";
import {Link, Typography, Paper} from "@material-ui/core";
import {Alert, AlertTitle} from "@material-ui/lab";
import {GitCommitIcon} from "@primer/octicons-react";
import useStyles from "./styles";

/**
 * Represents a single library item in a release.
 *
 * @param {Object} props - The component props.
 * @param {Object} props.library - The library details.
 * @param {String} props.library.libraryName - The name of the library.
 * @param {String} props.library.updatedVersion - The updated version of the
 * library.
 * @param {Boolean} props.library.optedIn - Whether the library was manually
 * opted into the release.
 * @param {Boolean} props.library.libraryGroupRelease - Whether the library
 * was included to keep version alignment with other libraries.
 * @param {Array} props.library.changes - An array of change objects with
 * commitLink, commitTitle, kotlin, pullRequestLink, pullRequestID.
 * @return {JSX.Element} The ReleaseLibraryItem component.
 */
function ReleaseLibraryItem({library}) {
  const classes = useStyles();

  const {
    libraryName,
    updatedVersion,
    optedIn,
    libraryGroupRelease,
    changes,
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
            ({commitLink, commitTitle, kotlin,
              pullRequestLink, pullRequestID}, index) => (
              <Typography variant="body2" color="textPrimary" key={index}>
                <Link href={commitLink} target="_blank" rel="noreferrer">
                  <GitCommitIcon className={classes.icon} size={16} />
                </Link>
                {commitTitle} {kotlin && " (Kotlin) "}
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
    libraryName: PropTypes.string.isRequired,
    updatedVersion: PropTypes.string.isRequired,
    optedIn: PropTypes.bool.isRequired,
    libraryGroupRelease: PropTypes.bool.isRequired,
    changes: PropTypes.arrayOf(
        PropTypes.shape({
          commitLink: PropTypes.string.isRequired,
          commitTitle: PropTypes.string.isRequired,
          kotlin: PropTypes.bool,
          pullRequestLink: PropTypes.string.isRequired,
          pullRequestID: PropTypes.string.isRequired,
        }),
    ).isRequired,
  }).isRequired,
};

export default ReleaseLibraryItem;
