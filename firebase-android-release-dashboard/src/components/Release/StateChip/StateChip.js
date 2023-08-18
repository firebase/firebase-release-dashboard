import {Chip} from "@material-ui/core";
import PropTypes from "prop-types";
import React, {useState} from "react";
import theme from "../../../config/theme";
import useRecentReleaseError from "../../../hooks/useReleaseError";
import {RELEASE_STATES} from "../../../utils/releaseStates";
import ReleaseErrorDialog from "../ReleaseErrorDialog/ReleaseErrorDialog";
import useStyles from "./styles";

const chipColor = (state) => {
  const color = theme.palette.primary.contrastText;
  const stateColors = {
    [RELEASE_STATES.CODE_FREEZE]: theme.palette.chip.blue,
    [RELEASE_STATES.RELEASE_DAY]: theme.palette.chip.purple,
    [RELEASE_STATES.RELEASED]: theme.palette.chip.green,
    [RELEASE_STATES.DELAYED]: theme.palette.chip.orange,
    [RELEASE_STATES.ERROR]: theme.palette.chip.error,
  };

  const backgroundColor = stateColors[state] || theme.palette.chip.gray;

  return {backgroundColor, color};
};

/**
 * Returns a chip containing the state of the release.
 *
 * If the release is in the ERROR state, the chip is clickable and opens a
 * dialog containing the error message.
 *
 * @param {string} state - The state of the release.
 * @param {string} releaseId - The ID of the release.
 * @param {boolean} isLoggedIn - Whether the user is logged in.
 * @return {JSX.Element} The StateChip component.
 */
function StateChip({state, releaseId, isLoggedIn}) {
  const styles = chipColor(state);
  const classes = useStyles(styles);
  const [openDialog, setOpenDialog] = useState(false);
  const releaseError = useRecentReleaseError(releaseId, isLoggedIn);

  const handleClickOpen = () => {
    setOpenDialog(true);
  };

  const handleClose = () => {
    setOpenDialog(false);
  };

  const isClickable = isLoggedIn && state === RELEASE_STATES.ERROR;

  return (
    <>
      <Chip
        label={state}
        className={classes.stateChip}
        style={{
          ...chipColor(state),
          cursor: isClickable ? "pointer" : "default",
        }}
        onClick={isClickable ? handleClickOpen : null}
      />
      <ReleaseErrorDialog
        open={openDialog}
        onClose={handleClose}
        releaseError={releaseError}
      />
    </>
  );
}

StateChip.propTypes = {
  state: PropTypes.oneOf(Object.values(RELEASE_STATES)).isRequired,
  releaseId: PropTypes.string.isRequired,
  isLoggedIn: PropTypes.bool.isRequired,
};

export default StateChip;
