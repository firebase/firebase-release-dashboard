import {
  Button,
  Grid,
  Typography,
} from "@material-ui/core";
import {Add} from "@mui/icons-material";
import PropTypes from "prop-types";
import React, {useEffect, useState} from "react";
import {addReleases} from "../../../api";
import AddReleaseDialog from "../AddReleaseDialog";
import useStyles from "./styles";

/**
 * Form for scheduling new releases.
 *
 * Administrators can add new releases by entering the release name,
 * release branch name, code freeze date, and release date.
 *
 * @param {function} openSnackbar - Function to open the snackbar to display
 * success or error messages.
 * @return {JSX.Element} - Rendered component.
 */
function AddReleaseForm({openSnackbar}) {
  const classes = useStyles();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formValid, setFormValid] = useState(false);
  const [formData, setFormData] = useState({
    releaseName: "",
    releaseBranchName: "",
    releaseOperator: "ACore team member", // Can't store user data
    codeFreezeDate: "",
    releaseDate: "",
  });

  /**
   * Check if the form is valid every time the form data changes.
   * The form is valid if all fields are filled out.
   */
  useEffect(() => {
    const isFormValid = Object.values(formData).every((value) => value !== "");
    setFormValid(isFormValid);
  }, [formData]);

  const handleClickOpen = () => setOpen(true);

  /**
   * Close the dialog and reset the form data.
   */
  const handleClose = () => {
    if (!loading) {
      setOpen(false);
      setFormData({
        releaseName: "",
        releaseBranchName: "",
        releaseOperator: "ACore team member",
        codeFreezeDate: "",
        releaseDate: "",
      });
    }
  };

  /**
   * Handle a change in the form data by updating the form data state.
   *
   * @param {Object} event - The DOM event which triggered the change.
   */
  const handleChange = (event) => {
    setFormData({
      ...formData,
      [event.target.name]: event.target.value,
    });
  };

  /**
   * Handle a click on the submit button by sending a request to Firebase
   * Functions to add the release.
   */
  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await addReleases([formData]);
      if (response.status === 200) {
        openSnackbar("Release added successfully", "success");
        handleClose();
      }
    } catch (error) {
      openSnackbar("Error occurred while scheduling release", "error");
    }
    setLoading(false);
  };

  return (
    <>
      <Button
        color="primary"
        onClick={handleClickOpen}
        className={classes.addReleaseButton}
      >
        <Grid container alignItems="center">
          <Grid item>
            <Add size={24} className={classes.addIcon}/>
          </Grid>
          <Grid item>
            <Typography
              variant="subtitle1"
              color="inherit"
              className={classes.addReleaseButtonText}
            >
            Add release
            </Typography>
          </Grid>
        </Grid>
      </Button>
      <AddReleaseDialog
        open={open}
        handleClose={handleClose}
        loading={loading}
        formValid={formValid}
        formData={formData}
        handleChange={handleChange}
        handleSubmit={handleSubmit}
      />
    </>
  );
}

AddReleaseForm.propTypes = {
  openSnackbar: PropTypes.func.isRequired,
};

export default AddReleaseForm;
