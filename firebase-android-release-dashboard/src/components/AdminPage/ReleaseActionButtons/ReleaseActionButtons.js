import {
  CircularProgress,
  IconButton,
  TableCell,
  Tooltip,
} from "@material-ui/core";
import {Delete, Edit, Sync} from "@mui/icons-material";
import PropTypes from "prop-types";
import React from "react";

/**
 * Displays the action buttons for a release row.
 *
 * @param {Object} refreshing - Whether the release is being refreshed.
 * @param {Object} deleting - Whether the release is being deleted.
 * @param {Function} handleRefreshClick - Function to handle refresh button
 * click.
 * @param {Function} handleEditClick - Function to handle edit button click.
 * @param {Function} handleDeleteClick - Function to handle delete button click.
 * @return {React.Component}
 */
function ReleaseActionButtons(
    {
      refreshing,
      deleting,
      handleRefreshClick,
      handleEditClick,
      handleDeleteClick,
    },
) {
  return (
    <TableCell>
      <Tooltip title="Sync with GitHub">
        <IconButton
          aria-label="sync"
          disabled={refreshing}
          onClick={handleRefreshClick}
          color="primary"
        >
          {refreshing ? <CircularProgress size={24} /> : <Sync />}
        </IconButton>
      </Tooltip>
      <Tooltip title="Edit Metadata">
        <IconButton
          aria-label="edit"
          onClick={handleEditClick}
        >
          <Edit />
        </IconButton>
      </Tooltip>
      <Tooltip title="Delete All Release Data">
        <IconButton
          aria-label="delete"
          disabled={deleting}
          onClick={handleDeleteClick}
        >
          {deleting ? <CircularProgress size={24} /> : <Delete />}
        </IconButton>
      </Tooltip>
    </TableCell>
  );
}

ReleaseActionButtons.propTypes = {
  refreshing: PropTypes.bool.isRequired,
  deleting: PropTypes.bool.isRequired,
  handleRefreshClick: PropTypes.func.isRequired,
  handleEditClick: PropTypes.func.isRequired,
  handleDeleteClick: PropTypes.func.isRequired,
};

export default ReleaseActionButtons;
