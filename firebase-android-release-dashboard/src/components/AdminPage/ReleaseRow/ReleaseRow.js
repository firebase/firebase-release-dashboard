import {TableRow} from "@material-ui/core";
import PropTypes from "prop-types";
import React, {useEffect, useState} from "react";
import useAdminReleaseActions from "../../../hooks/useAdminReleaseActions";
import useRelease from "../../../hooks/useRelease";
import EditReleaseDialog from "../EditReleaseDialog";
import ReleaseRowContent from "../ReleaseRowContent";
import useStyles from "./styles";

/**
 * ReleaseRow component.
 *
 * Displays a single release row with the release's metadata and action buttons.
 * Administrators can edit, refresh, and delete releases.
 *
 * @param {Object} releaseID - The ID of the release to display.
 * @param {Function} openSnackbar - Function to open the snackbar to display
 * success or error messages.
 * @return {JSX.Element} Rendered component.
 */
function ReleaseRow({releaseId, openSnackbar}) {
  const classes = useStyles();
  const release = useRelease(releaseId);
  const [editing, setEditing] = useState(false);
  const [editedRelease, setEditedRelease] = useState(null);

  // State and handlers for administrator release actions
  const {
    deleting,
    refreshing,
    submitting,
    handleDeleteClick,
    handleRefreshClick,
    handleSubmitClick,
  } = useAdminReleaseActions(release, openSnackbar, setEditing);

  /**
   * Set the edited release state to the release state when the release state
   * changes. This is necessary because the release state is fetched from
   * Firestore asynchronously, and the edited release state is initialized to
   * null. If the release state is updated after the edited release state is
   * initialized, we need to update the edited release state to the new release
   * state.
   */
  useEffect(() => {
    setEditedRelease(release);
  }, [release]);

  // This only occurs when the release has not been fetched from Firestore yet
  if (!release || !editedRelease) {
    return null;
  }

  /**
   * Handle a click on the edit button by setting the editing state to true.
   * This will display the edit release dialog.
   */
  const handleEditClick = () => {
    setEditing(true);
  };

  /**
   * Handle a click on the cancel button by setting the editing state to false
   * and resetting the edited release state to the original release state.
   */
  const handleCancelClick = () => {
    setEditing(false);
    setEditedRelease(release);
  };

  /**
   * Handle a change in the edit release form by updating the edited release
   * state.
   *
   * @param {Object} event - The event that triggered the change.
   */
  const handleChange = (event) => {
    if (event.target.name === "releaseDate" ||
      event.target.name === "codeFreezeDate") {
      setEditedRelease({
        ...editedRelease,
        [event.target.name]: new Date(event.target.value),
      });
    } else {
      setEditedRelease({
        ...editedRelease,
        [event.target.name]: event.target.value,
      });
    }
  };

  return (
    <>
      <TableRow className={classes.tableRow}>
        <ReleaseRowContent
          release={release}
          refreshing={refreshing}
          deleting={deleting}
          handleRefreshClick={handleRefreshClick}
          handleEditClick={handleEditClick}
          handleDeleteClick={handleDeleteClick}
        />
      </TableRow>
      <EditReleaseDialog
        editing={editing}
        editedRelease={editedRelease}
        submitting={submitting}
        handleCancelClick={handleCancelClick}
        handleSubmitClick={handleSubmitClick}
        handleChange={handleChange}
      />
    </>
  );
}

ReleaseRow.propTypes = {
  releaseId: PropTypes.string.isRequired,
  openSnackbar: PropTypes.func.isRequired,
};

export default ReleaseRow;
