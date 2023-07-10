import {
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
} from "@material-ui/core";
import PropTypes from "prop-types";
import React, {Suspense, lazy} from "react";

const ChecksList = lazy(() => import("../ChecksList"));

/**
   * A Dialog to show all the checks.
   *
   * @param {Object} props - The component props.
   * @param {boolean} props.open - Boolean to control dialog's open/close state.
   * @param {Function} props.onClose - Function to handle dialog close.
   * @param {Array} props.checks - Array of checks to be displayed.
   * @return {JSX.Element} The Dialog component.
   */
function ChecksDialog({open, onClose, checks}) {
  return (
    <Dialog open={open} onClose={onClose} scroll="paper">
      <DialogTitle id="scroll-dialog-title">Checks</DialogTitle>
      <DialogContent dividers>
        <Suspense fallback={<CircularProgress />}>
          <ChecksList checks={checks} />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}

ChecksDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  checks: PropTypes.array.isRequired,
};

export default ChecksDialog;
