import {Box, Container, Paper, Snackbar, Typography} from "@material-ui/core";
import {Alert} from "@material-ui/lab";
import React, {useState} from "react";
import AddReleaseForm from "../AddReleaseForm";
import ReleaseTable from "../ReleaseTable/ReleaseTable";
import useStyles from "./styles";

/**
 * Admin page.
 *
 * Displays the admin dashboard, which contains the release scheduling form
 * and the release table that allows administrators to interact with releases.
 *
 * @return {JSX.Element} - Rendered component
 */
function AdminMain() {
  const classes = useStyles();
  const [snackbarIsOpen, setSnackbarIsOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState("");

  /**
   * Opens the snackbar with the given message and severity.
   *
   * @param {string} message - The message to display on the snackbar.
   * @param {string} severity - The severity of the snackbar message.
   */
  const openSnackbar = (message, severity) => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarIsOpen(true);
  };

  /**
   * Closes the snackbar when it is clicked away.
   *
   * @param {Object} event - The DOM event which led to the snackbar closing.
   * @param {string} reason - The reason for the snackbar closing.
   */
  const handleSnackbarClose = (event, reason) => {
    if (reason === "clickaway") return;
    setSnackbarIsOpen(false);
  };

  return (
    <Box className={classes.backdrop}>
      <Container component={Paper} className={classes.paper}>
        <Typography variant="h4" className={classes.title}>
          Release Administration
        </Typography>
        <AddReleaseForm openSnackbar={openSnackbar} />
        <ReleaseTable openSnackbar={openSnackbar} />
        <Snackbar
          open={snackbarIsOpen}
          autoHideDuration={6000}
          onClose={handleSnackbarClose}
        >
          <Alert onClose={handleSnackbarClose} severity={snackbarSeverity}>
            {snackbarMessage}
          </Alert>
        </Snackbar>
      </Container>
    </Box>
  );
}

export default AdminMain;
