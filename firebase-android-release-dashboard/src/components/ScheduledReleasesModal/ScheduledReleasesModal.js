import {
  Modal,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@material-ui/core";
import {format} from "date-fns";
import PropTypes from "prop-types";
import React from "react";
import {RELEASE_STATES} from "../../utils/releaseStates";
import useReleases from "../../hooks/useReleases";
import useStyles from "./styles";

// Constants for table headers
const tableHeaders = [
  "Release Name",
  "Code Freeze Date",
  "Release Date",
  "Release Branch",
  "State",
];

/**
 * ScheduledReleasesModal component renders a modal with a table that displays
 * the scheduled releases.
 *
 * @param {Object} props Component props
 * @param {boolean} props.open If true, the modal is open. Otherwise, it is
 * closed.
 * @param {Function} props.handleClose Function to close the modal.
 * @param {Array} props.scheduledReleases List of scheduled releases to display
 * in the table.
 *
 * @return {JSX.Element} The rendered component
 */
function ScheduledReleasesModal({open, handleClose}) {
  const classes = useStyles();
  const scheduledReleases = useReleases(RELEASE_STATES.SCHEDULED, null);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      aria-labelledby="scheduled-releases-modal-title"
      aria-describedby="scheduled-releases-modal-description"
    >
      <div className={classes.paper}>
        <h2 id="scheduled-releases-modal-title">Scheduled Releases</h2>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                {tableHeaders.map((header) => (
                  <TableCell key={header} align="right">
                    {header}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {scheduledReleases.map((release) => (
                <TableRow key={release.releaseName}>
                  <TableCell component="th" scope="row">
                    {release.releaseName}
                  </TableCell>
                  <TableCell align="right">
                    {format(new Date(release.codeFreezeDate), "MMM. dd, yyyy")}
                  </TableCell>
                  <TableCell align="right">
                    {format(new Date(release.releaseDate), "MMM. dd, yyyy")}
                  </TableCell>
                  <TableCell align="right">
                    {release.releaseBranchName}
                  </TableCell>
                  <TableCell align="right">{release.state}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </div>
    </Modal>
  );
}

ScheduledReleasesModal.propTypes = {
  open: PropTypes.bool.isRequired,
  handleClose: PropTypes.func.isRequired,
};

export default ScheduledReleasesModal;
