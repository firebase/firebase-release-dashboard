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
import useReleasingLibraries from "../../../hooks/useReleasingLibraries.js";

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
 * @param {String} release.id - The id of the release.
 * @param {String} release.releaseName - The name of the release.
 * @param {Date} release.releaseDate - The date of the release.
 * @param {Date} release.codeFreezeDate - The date of the code freeze.
 * @param {String} release.state - The state of the release.
 * @param {String} release.releaseBranchName - The name of the release branch.
 * @param {String} release.releaseBranchLink - The link to the release branch.
 * @param {String} release.buildArtifactStatus - The status of the build
 * artifact.
 * @param {String} release.buildArtifactConclusion - The conclusion of the
 * build artifact.
 * @param {String} release.buildArtifactLink - The link to the build artifact.
 * @return {JSX.Element} The rendered JSX element.
 */
function ReleaseDetails({release}) {
  const classes = useStyles();

  const libraries = useReleasingLibraries(release.id);
  const sortedLibraries = sortLibraries(libraries);

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
            <GithubChecks releaseId={release.id} />
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
    id: PropTypes.string.isRequired,
    releaseName: PropTypes.string.isRequired,
    releaseDate: PropTypes.instanceOf(Date).isRequired,
    codeFreezeDate: PropTypes.instanceOf(Date).isRequired,
    state: PropTypes.oneOf(Object.values(RELEASE_STATES)).isRequired,
    releaseBranchName: PropTypes.string.isRequired,
    releaseBranchLink: PropTypes.string.isRequired,
    buildArtifactStatus: PropTypes.string.isRequired,
    buildArtifactConclusion: PropTypes.string.isRequired,
    buildArtifactLink: PropTypes.string.isRequired,
  }).isRequired,
};

export default ReleaseDetails;
