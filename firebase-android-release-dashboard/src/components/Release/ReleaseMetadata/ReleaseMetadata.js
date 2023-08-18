import React from "react";
import PropTypes from "prop-types";
import {Grid, Typography} from "@material-ui/core";
import {format} from "date-fns";
import {RELEASE_STATES} from "../../../utils/releaseStates";
import useStyles from "./styles";
import StateChip from "../StateChip/StateChip";
import {useAuthentication} from "../../../hooks/useAuthentication";

/**
 * Represents the metadata of a single release.
 *
 * @component
 * @param {Object} release - The release to render.
 * @param {String} release.releaseName - The name of the release.
 * @param {Date} release.releaseDate - The date of the release.
 * @param {Date} release.codeFreezeDate - The date of the code freeze.
 * @param {String} release.state - The state of the release.
 * @return {JSX.Element} The ReleaseMetadata component.
 */
function ReleaseMetadata({release}) {
  const classes = useStyles();
  const {isLoggedIn} = useAuthentication();

  const {
    id,
    releaseName,
    releaseDate,
    codeFreezeDate,
    state,
  } = release;

  return (
    <Grid container className={classes.metadata}>
      <Grid item xs={3}>
        <Typography
          variant="h5"
          color="textPrimary"
          className={classes.metadataItem}
        >
          {releaseName}
        </Typography>
      </Grid>
      <Grid item xs={3}>
        <Typography
          variant="subtitle1"
          color="textPrimary"
          className={classes.metadataItem}
        >
          {format(codeFreezeDate, "MMM. dd, yyyy")}
        </Typography>
      </Grid>
      <Grid item xs={3}>
        <Typography
          variant="subtitle1"
          color="textPrimary"
          className={classes.metadataItem}
        >
          {format(releaseDate, "MMM. dd, yyyy")}
        </Typography>
      </Grid>
      <Grid item xs={3}>
        <StateChip
          state={state}
          releaseId={id}
          isLoggedIn={isLoggedIn}
        />
      </Grid>
    </Grid>
  );
}

ReleaseMetadata.propTypes = {
  release: PropTypes.shape({
    id: PropTypes.string.isRequired,
    releaseName: PropTypes.string.isRequired,
    releaseDate: PropTypes.instanceOf(Date).isRequired,
    codeFreezeDate: PropTypes.instanceOf(Date).isRequired,
    state: PropTypes.oneOf(Object.values(RELEASE_STATES)).isRequired,
  }).isRequired,
};

export default ReleaseMetadata;
