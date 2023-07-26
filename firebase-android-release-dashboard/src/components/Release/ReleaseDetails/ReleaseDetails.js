import {Grid, Link, Typography} from "@material-ui/core";
import {Alert} from "@material-ui/lab";
import {GitBranchIcon} from "@primer/octicons-react";
import PropTypes from "prop-types";
import React from "react";
import {RELEASE_STATES} from "../../../utils/releaseStates.js";
import BuildArtifacts from "../BuildArtifacts/BuildArtifacts.js";
import GithubChecks from "../GithubChecks/index.js";
import ReleaseLibraries from "../ReleaseLibraries/ReleaseLibraries.js";
import useStyles from "./styles.js";

// Sort libraries alphabetically by name
const sortLibraries = (libraries) => {
  return [...libraries]
      .sort((a, b) => a.libraryName.localeCompare(b.libraryName));
};

/**
 * Component to display details of a release that has release data.
 *
 * All releases that are not in the "scheduled" state have release data.
 *
 * @param {Object} release - An object containing release details.
 * @return {JSX.Element} The rendered JSX element.
 */
function ReleaseDetails({release}) {
  const classes = useStyles();

  const sortedLibraries = sortLibraries(release.libraries);

  if (release.state === RELEASE_STATES.ERROR) {
    return (
      <Alert severity="error">
        This release is in an error state. Please contact the release operator.
      </Alert>
    );
  } else if (
    release.state === RELEASE_STATES.CODE_FREEZE ||
    release.state === RELEASE_STATES.RELEASE_DAY ||
    release.state === RELEASE_STATES.RELEASED ||
    release.state === RELEASE_STATES.DELAYED
  ) {
    return (
      <>
        <ReleaseLibraries libraries={sortedLibraries} />
        <Grid container justifyContent="center" alignItems="center" spacing={3}>
          <Grid item xs="auto">
            <GithubChecks checks={release.checks} />
          </Grid>
          <Grid item xs="auto">
            <BuildArtifacts
              buildArtifactStatus={release.buildArtifactStatus}
              buildArtifactConclusion={release.buildArtifactConclusion}
              buildArtifactLink={release.buildArtifactLink}
            />
          </Grid>
          <Grid item xs="auto">
            <Link
              href={release.releaseBranchLink}
              rel="noopener noreferrer"
            >
              <Typography variant="body2" color="textPrimary">
                <GitBranchIcon size={24} className={classes.releaseBranchIcon}/>
                {release.releaseBranchName}
              </Typography>
            </Link>
          </Grid>
        </Grid>
      </>
    );
  } else {
    throw new Error(`Release state "${release.state}" not recognized`);
  }
}

ReleaseDetails.propTypes = {
  release: PropTypes.shape({
    state: PropTypes.string.isRequired,
    libraries: PropTypes.arrayOf(
        PropTypes.shape({
          libraryName: PropTypes.string.isRequired,
        }),
    ).isRequired,
    checks: PropTypes.arrayOf(PropTypes.object).isRequired,
    buildArtifactStatus: PropTypes.string,
    buildArtifactConclusion: PropTypes.string,
    buildArtifactLink: PropTypes.string,
    releaseBranchLink: PropTypes.string.isRequired,
    releaseBranchName: PropTypes.string.isRequired,
  }).isRequired,
};

export default ReleaseDetails;
