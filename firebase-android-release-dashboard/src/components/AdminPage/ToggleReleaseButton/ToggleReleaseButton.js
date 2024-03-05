import {Button, CircularProgress, Typography} from "@material-ui/core";
import {Check, History} from "@mui/icons-material";
import PropTypes from "prop-types";
import React from "react";
import {RELEASE_STATES} from "../../../utils/releaseStates";
import useStyles from "./styles";

const toggleIsDisabled = {
  [RELEASE_STATES.SCHEDULED]: true,
  [RELEASE_STATES.CODE_FREEZE]: false,
  [RELEASE_STATES.RELEASE_DAY]: false,
  [RELEASE_STATES.RELEASED]: false,
  [RELEASE_STATES.DELAYED]: false,
  [RELEASE_STATES.ERROR]: true,
};

/**
 * A button that toggles the release state between released and delayed.
 *
 * @param {Object} release - Release object
 * @param {string} release.state - Release state.
 * @param {boolean} toggling - Whether the release state is being toggled.
 * @param {Function} handleReleasedToggle - Function to handle released toggle
 * @return {JSX.Element} Rendered component.
 */
function ToggleReleaseButton({release, toggling, handleReleasedToggle}) {
  const classes = useStyles();

  let buttonText; let buttonIcon; let buttonClass;
  switch (release.state) {
    case RELEASE_STATES.RELEASED:
      buttonText = "Mark as Delayed";
      buttonIcon = <History />;
      buttonClass = classes.unemphasizedButton;
      break;
    default:
      buttonText = "Mark as Released";
      buttonIcon = <Check />;
      buttonClass = classes.emphasizedButton;
      break;
  }

  return (
    <Button
      size={"small"}
      variant={"contained"}
      disabled={toggleIsDisabled[release.state]}
      onClick={() => handleReleasedToggle(release)}
      className={buttonClass}
      startIcon={
            toggling ?
            <CircularProgress
              size={20}
              color="white"
              className={classes.releaseButtonIcon}
            /> :
             buttonIcon
      }
    >
      <Typography className={classes.releaseButtonText}>
        {buttonText}
      </Typography>
    </Button>
  );
}

ToggleReleaseButton.propTypes = {
  release: PropTypes.shape({
    state: PropTypes.string.isRequired,
  }).isRequired,
  toggling: PropTypes.bool.isRequired,
  handleReleasedToggle: PropTypes.func.isRequired,
};

export default ToggleReleaseButton;
