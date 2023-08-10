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
import PropTypes from "prop-types";
import React from "react";


/**
 * Dialog for adding new releases.
 *
 * @param {bool} open - Whether the dialog is open.
 * @param {bool} loading - Whether the form is submitting.
 * @param {bool} formValid - Whether the form is valid.
 * @param {Object} formData - The data in the form.
 * @param {function} handleClose - Function to handle a click on the cancel
 * button.
 * @param {function} handleChange - Function to handle a change in the form.
 * @param {function} handleSubmit - Function to handle a click on the submit
 * button.
 * @return {JSX.Element} Rendered component.
 */
function AddReleaseDialog(
    {
      open,
      loading,
      formValid,
      formData,
      handleClose,
      handleChange,
      handleSubmit,
    },
) {
  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>
        <Typography variant="h6">
          Add Release
        </Typography>
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          <Typography variant="body1">
            Please enter the release metadata.
          </Typography>
        </DialogContentText>
        <TextField
          margin="dense"
          variant="outlined"
          name="releaseName"
          label="Release Name"
          value={formData.releaseName}
          onChange={handleChange}
          fullWidth
        />
        <TextField
          margin="dense"
          variant="outlined"
          name="releaseBranchName"
          label="Release Branch Name"
          value={formData.releaseBranchName}
          onChange={handleChange}
          fullWidth
        />
        <TextField
          margin="dense"
          variant="outlined"
          name="codeFreezeDate"
          label="Code Freeze Date"
          type="date"
          value={formData.codeFreezeDate}
          onChange={handleChange}
          InputLabelProps={{shrink: true}}
          fullWidth
        />
        <TextField
          margin="dense"
          variant="outlined"
          name="releaseDate"
          label="Release Date"
          type="date"
          value={formData.releaseDate}
          onChange={handleChange}
          InputLabelProps={{shrink: true}}
          fullWidth
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="primary" disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          color="primary"
          disabled={!formValid || loading}
        >
          {loading ? <CircularProgress size={24} /> : "Schedule"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

AddReleaseDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  loading: PropTypes.bool.isRequired,
  formValid: PropTypes.bool.isRequired,
  formData: PropTypes.shape({
    releaseName: PropTypes.string.isRequired,
    releaseBranchName: PropTypes.string.isRequired,
    codeFreezeDate: PropTypes.string.isRequired,
    releaseDate: PropTypes.string.isRequired,
  }).isRequired,
  handleClose: PropTypes.func.isRequired,
  handleChange: PropTypes.func.isRequired,
  handleSubmit: PropTypes.func.isRequired,
};

export default AddReleaseDialog;
