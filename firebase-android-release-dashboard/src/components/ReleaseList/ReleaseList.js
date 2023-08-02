import {Box, Grid, Typography} from "@material-ui/core";
import React from "react";
import ReleaseCard from "../Release/ReleaseCard";
import useStyles from "./styles";
import useReleases from "../../hooks/useReleases";
import {RELEASE_STATES} from "../../utils/releaseStates";

const RELEASE_NAME_HEADER = "Release Name";
const RELEASE_DATE_HEADER = "Release Date";
const CODE_FREEZE_DATE_HEADER = "Code Freeze Date";
const STATE_HEADER = "State";

const releaseListHeaderItems = [
  RELEASE_NAME_HEADER,
  RELEASE_DATE_HEADER,
  CODE_FREEZE_DATE_HEADER,
  STATE_HEADER,
];

/**
 * Renders a list of releases.
 *
 * Each release is displayed with its details by a ReleaseCard.
 *
 * @param {Object[]} releases - The list of releases to display.
 * @return {JSX.Element} A box component containing a grid of
 * release details and a list of ReleaseCards.
 */
function ReleaseList() {
  const classes = useStyles();
  const releases = useReleases(null, RELEASE_STATES.SCHEDULED);

  return (
    <Box>
      <Grid container className={classes.metadataHeaders}>
        {releaseListHeaderItems.map((item, index) => (
          <Grid item xs={3} key={index} className={classes.metadataHeaderItem}>
            <Typography variant="subtitle1">
              {item}
            </Typography>
          </Grid>
        ))}
      </Grid>
      {releases.map((release) => (
        <ReleaseCard key={release.id} releaseId={release.id} />
      ))}
    </Box>
  );
}

export default ReleaseList;
