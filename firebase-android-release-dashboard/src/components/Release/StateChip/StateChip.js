import React from "react";
import PropTypes from "prop-types";
import {Chip} from "@material-ui/core";
import {RELEASE_STATES} from "../../../utils/releaseStates";
import useStyles from "./styles";
import theme from "../../../config/theme";

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
 * @param {string} state - The state of the release.
 * @return {JSX.Element} The StateChip component.
 */
function StateChip({state}) {
  const styles = chipColor(state);
  const classes = useStyles(styles);

  return (
    <Chip
      label={state}
      className={classes.stateChip}
      styles={chipColor(state)}
    />
  );
}

StateChip.propTypes = {
  state: PropTypes.oneOf(Object.values(RELEASE_STATES)).isRequired,
};

export default StateChip;
