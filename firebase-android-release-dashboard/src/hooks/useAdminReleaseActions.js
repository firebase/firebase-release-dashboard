import {useState} from "react";
import {deleteRelease, modifyRelease, refreshRelease} from "../api";

/**
 * Custom React hook to handle administrator release actions.
 *
 * Returns the state and handlers for deleting, refreshing, and submitting
 * a single release. These handlers are passed to buttons that allow the
 * administrator to perform these actions.
 *
 * @param {Object} release - The release object.
 * @param {Function} openSnackbar - Function to open the snackbar.
 * @param {Function} setEditing - Function to set the editing state.
 * @return {Object} An object containing states and handler functions for
 * release actions.
 */
const useReleaseActions = (release, openSnackbar, setEditing) => {
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toggling, setToggling] = useState(false);

  /**
   * Handle a click on the delete button by calling the deleteRelease API
   */
  const handleDeleteClick = async () => {
    setDeleting(true);
    try {
      const response = await deleteRelease(release.id);
      if (response.status === 200) {
        openSnackbar("Release deleted successfully", "success");
      } else {
        openSnackbar("Failed to delete release", "error");
      }
    } catch (error) {
      // TODO: Fetch full error from Firestore, and display it
      openSnackbar("Error occurred while deleting release", "error");
    }
    setDeleting(false);
  };

  /**
   * Handle a click on the refresh button by calling the refreshRelease API
   */
  const handleRefreshClick = async () => {
    setRefreshing(true);
    try {
      const response = await refreshRelease(release.id);
      if (response.status === 200) {
        openSnackbar("Release refreshed successfully", "success");
      } else {
        openSnackbar("Failed to refresh release", "error");
      }
    } catch (error) {
      // TODO: Fetch full error from Firestore, and display it
      openSnackbar("Error occurred while refreshing release", "error");
    }
    setRefreshing(false);
  };

  /**
   * Handle a submission of edited release data, and update the release
   * with the modifyRelease API.
   *
   * @param {Object} editedRelease
   */
  const handleSubmitClick = async (editedRelease) => {
    setSubmitting(true);
    try {
      const response = await modifyRelease(
          release.id,
          editedRelease.releaseName,
          editedRelease.releaseBranchName,
          "ACore team member", // TODO: Replace with actual operator
          editedRelease.codeFreezeDate,
          editedRelease.releaseDate,
          editedRelease.isReleased,
      );
      if (response.status === 200) {
        openSnackbar("Release modified successfully", "success");
        setEditing(false);
      } else {
        openSnackbar("Failed to modify release", "error");
      }
    } catch (error) {
      // TODO: Fetch full error from Firestore, and display it
      openSnackbar("Error occurred while modifying release", "error");
    }
    setSubmitting(false);
  };

  /**
   * Handle a click on the released toggle button by calling the modifyRelease
   * API with the toggled release state.
   *
   * @param {Object} release
   */
  const handleReleasedToggle = async (release) => {
    setToggling(true);
    try {
      const response = await modifyRelease(
          release.id,
          release.releaseName,
          release.releaseBranchName,
          release.releaseOperator,
          release.codeFreezeDate,
          release.releaseDate,
          !release.isReleased, // Toggle
      );
      if (response.status === 200) {
        openSnackbar("Release state toggled sucessfully", "success");
      } else {
        openSnackbar("Failed to toggle release state", "error");
      }
    } catch (error) {
      openSnackbar("Error occurred while toggling release state", "error");
    }
    setToggling(false);
  };

  return {
    deleting,
    refreshing,
    submitting,
    toggling,
    handleDeleteClick,
    handleRefreshClick,
    handleSubmitClick,
    handleReleasedToggle,
  };
};

export default useReleaseActions;
