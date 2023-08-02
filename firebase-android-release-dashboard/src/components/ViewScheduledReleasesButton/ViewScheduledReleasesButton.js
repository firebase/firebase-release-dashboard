import React from "react";
import {Button, Grid, Typography} from "@material-ui/core";
import {Schedule} from "@mui/icons-material";
import PropTypes from "prop-types";
import useStyles from "./styles";

/**
 * ViewScheduledReleasesButton is a button that opens the ScheduledReleasesModal
 *
 * @param {Function} props.onClick - The function to call when the button is
 * clicked.
 * @return {JSX.Element} - The ViewScheduledReleasesButton component.
 */
function ViewScheduledReleasesButton({onClick}) {
  const classes = useStyles();

  return (
    <Button
      variant="contained"
      color="primary"
      className={classes.scheduledReleasesButton}
      onClick={onClick}
    >
      <Grid container alignItems="center">
        <Grid item>
          <Schedule size={24} className={classes.scheduleIcon}/>
        </Grid>
        <Grid item>
          <Typography
            variant="subtitle1"
            color="inherit"
            className={classes.scheduledReleasesButtonText}
          >
            View Scheduled Releases
          </Typography>
        </Grid>
      </Grid>
    </Button>
  );
}

ViewScheduledReleasesButton.propTypes = {
  onClick: PropTypes.func.isRequired,
};

export default ViewScheduledReleasesButton;
