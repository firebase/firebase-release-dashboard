import {
  Table, TableBody,
  TableCell,
  TableContainer,
  TableHead, TableRow, Typography,
} from "@material-ui/core";
import PropTypes from "prop-types";
import React from "react";
import useReleases from "../../../hooks/useReleases";
import ReleaseRow from "../ReleaseRow/ReleaseRow";
import useStyles from "./styles";

const tableHeaders = [
  "Release Name",
  "Code Freeze Date",
  "Release Date",
  "Release Branch",
  "State",
  "", // Buttons
];

/**
 * Displays a table of releases. Each row in the table is a ReleaseRow
 * component which displays information about a release and allows the user
 * to edit, delete or refresh the release by sending requests to Firebase
 * Functions.
 *
 * @param {function} openSnackbar - Function to open the snackbar to display
 * success or error messages.
 * @return {JSX.Element} Rendered AdminReleaseTable component.
 */
function ReleaseTable({openSnackbar}) {
  const classes = useStyles();
  const releases = useReleases(null, null);

  return (
    <div className={classes.container}>
      <TableContainer className={classes.tableContainer}>
        <Table className={classes.table}>
          <TableHead>
            <TableRow>
              {tableHeaders.map((header) => (
                <TableCell key={header}>
                  <Typography
                    variant="body1"
                    className={classes.tableHeader}
                  >
                    {header}
                  </Typography>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {releases.map((release) => (
              <ReleaseRow
                key={release.id}
                releaseId={release.id}
                openSnackbar={openSnackbar}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
}

ReleaseTable.propTypes = {
  openSnackbar: PropTypes.func.isRequired,
};

export default ReleaseTable;
