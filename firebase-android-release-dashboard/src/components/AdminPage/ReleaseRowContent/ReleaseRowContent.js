import {TableCell, Typography} from "@material-ui/core";
import {format} from "date-fns";
import PropTypes from "prop-types";
import React from "react";
import {RELEASE_STATES} from "../../../utils/releaseStates";
import StateChip from "../../Release/StateChip/StateChip";
import ReleaseActionButtons from "../ReleaseActionButtons/ReleaseActionButtons";
import ToggleReleaseButton from "../ToggleReleaseButton/ToggleReleaseButton";

/**
 * Displays the release's metadata in table cells.
 *
 * @param {Object} release - Release object
 * @param {string} release.id - Release ID.
 * @param {string} release.releaseName - Release name.
 * @param {Date} release.codeFreezeDate - Code freeze date.
 * @param {Date} release.releaseDate - Release date.
 * @param {string} release.releaseBranchName - Release branch name.
 * @param {string} release.state - Release state.
 * @param {boolean} refreshing - Whether the release is being refreshed.
 * @param {boolean} deleting - Whether the release is being deleted.
 * @param {boolean} toggling - Whether the release state is being toggled.
 * @param {Function} handleRefreshClick - Function to handle refresh button
 * click.
 * @param {Function} handleEditClick - Function to handle edit button click.
 * @param {Function} handleDeleteClick - Function to handle delete button click.
 * @param {Function} handleReleasedToggle - Function to handle released toggle
 * @return {JSX.Element} Rendered component.
 */
function ReleaseRowContent(
    {
      release,
      refreshing,
      deleting,
      toggling,
      handleRefreshClick,
      handleEditClick,
      handleDeleteClick,
      handleReleasedToggle,
    },
) {
  return (
    <>
      <TableCell>
        <Typography variant="body1" color="textPrimary">
          {release.releaseName}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="textPrimary">
          {format(release.codeFreezeDate, "MMM. dd, yyyy")}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="textPrimary">
          {format(release.releaseDate, "MMM. dd, yyyy")}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="textPrimary">
          {release.releaseBranchName}
        </Typography>
      </TableCell>
      <TableCell>
        <StateChip
          state={release.state}
          releaseId={release.id}
          isLoggedIn={true}
        />
      </TableCell>
      <TableCell>
        <ToggleReleaseButton
          release={release}
          toggling={toggling}
          handleReleasedToggle={handleReleasedToggle}
        />
      </TableCell>
      <ReleaseActionButtons
        refreshing={refreshing}
        deleting={deleting}
        handleRefreshClick={handleRefreshClick}
        handleEditClick={handleEditClick}
        handleDeleteClick={handleDeleteClick}
      />
    </>
  );
}

ReleaseRowContent.propTypes = {
  release: PropTypes.shape({
    id: PropTypes.string.isRequired,
    releaseName: PropTypes.string.isRequired,
    codeFreezeDate: PropTypes.instanceOf(Date).isRequired,
    releaseDate: PropTypes.instanceOf(Date).isRequired,
    releaseBranchName: PropTypes.string.isRequired,
    state: PropTypes.oneOf(Object.values(RELEASE_STATES)).isRequired,
  }).isRequired,
  refreshing: PropTypes.bool.isRequired,
  deleting: PropTypes.bool.isRequired,
  toggling: PropTypes.bool.isRequired,
  handleRefreshClick: PropTypes.func.isRequired,
  handleEditClick: PropTypes.func.isRequired,
  handleDeleteClick: PropTypes.func.isRequired,
  handleReleasedToggle: PropTypes.func.isRequired,
};

export default ReleaseRowContent;
