import {
  Button,
  Dialog, DialogActions, DialogContent,
  DialogContentText, DialogTitle,
} from "@material-ui/core";
import PropTypes from "prop-types";
import React from "react";
import useStyles from "./styles";

/**
 * A dialog to display the error details of a release.
 *
 * @param {Object} open - Whether the dialog is open.
 * @param {Object} onClose - Function to handle close.
 * @param {Object} releaseError - The error object.
 * @return {JSX.Element} Rendered component.
 */
function ReleaseErrorDialog({open, onClose, releaseError}) {
  const classes = useStyles();
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Error Details</DialogTitle>
      <DialogContent>
        <DialogContentText className={classes.stackTrace}>
          {
              releaseError ?
              releaseError.stackTrace :
              "No stack trace available. Check the Functions logs."
          }
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
            Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

ReleaseErrorDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  releaseError: PropTypes.object,
};

export default ReleaseErrorDialog;
