import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  Typography,
} from "@material-ui/core";
import {format} from "date-fns";
import PropTypes from "prop-types";
import React from "react";

/**
 * Dialog to edit release metadata.
 *
 * @param {bool} editing - Whether the dialog is open.
 * @param {Object} editedRelease - The release to edit.
 * @param {bool} submitting - Whether the form is submitting.
 * @param {function} handleCancelClick - Function to handle a click on the
 * cancel button.
 * @param {function} handleSubmitClick - Function to handle a click on the
 * submit button.
 * @param {function} handleChange - Function to handle a change in the form.
 * @return {JSX.Element} Rendered component.
 */
function EditReleaseDialog(
    {
      editing,
      editedRelease,
      submitting,
      handleCancelClick,
      handleSubmitClick,
      handleChange,
    },
) {
  return (
    <Dialog open={editing} onClose={handleCancelClick}>
      <DialogTitle>
        <Typography variant="h6">
          Edit Release
        </Typography>
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          <Typography variant="body1">
            Please enter the updated release metadata.
          </Typography>
        </DialogContentText>
        <TextField
          margin="dense"
          variant="outlined"
          name="releaseName"
          label="Release Name"
          value={editedRelease.releaseName}
          onChange={handleChange}
          fullWidth
        />
        <TextField
          margin="dense"
          variant="outlined"
          name="releaseBranchName"
          label="Release Branch Name"
          value={editedRelease.releaseBranchName}
          onChange={handleChange}
          fullWidth
        />
        <TextField
          margin="dense"
          variant="outlined"
          name="codeFreezeDate"
          label="Code Freeze Date"
          type="date"
          value={format(editedRelease.codeFreezeDate, "yyyy-MM-dd")}
          onChange={handleChange}
          InputLabelProps={{
            shrink: true,
          }}
          fullWidth
        />
        <TextField
          margin="dense"
          variant="outlined"
          name="releaseDate"
          label="Release Date"
          type="date"
          value={format(editedRelease.releaseDate, "yyyy-MM-dd")}
          onChange={handleChange}
          InputLabelProps={{
            shrink: true,
          }}
          fullWidth
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancelClick} color="primary">
          Cancel
        </Button>
        <Button
          onClick={() => handleSubmitClick(editedRelease)}
          color="primary"
          disabled={submitting}
        >
          {submitting ? <CircularProgress size={24} /> : "Submit"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

EditReleaseDialog.propTypes = {
  editing: PropTypes.bool.isRequired,
  editedRelease: PropTypes.shape({
    id: PropTypes.string.isRequired,
    releaseName: PropTypes.string.isRequired,
    codeFreezeDate: PropTypes.instanceOf(Date).isRequired,
    releaseDate: PropTypes.instanceOf(Date).isRequired,
    releaseBranchName: PropTypes.string.isRequired,
    state: PropTypes.string.isRequired,
  }).isRequired,
  submitting: PropTypes.bool.isRequired,
  handleCancelClick: PropTypes.func.isRequired,
  handleSubmitClick: PropTypes.func.isRequired,
  handleChange: PropTypes.func.isRequired,
};

export default EditReleaseDialog;

