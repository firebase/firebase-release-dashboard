import {
  Button,
} from "@material-ui/core";
import {MarkGithubIcon} from "@primer/octicons-react";
import PropTypes from "prop-types";
import React, {useState} from "react";
import ChecksDialog from "../ChecksDialog";
import useStyles from "./styles";

/**
 * Component showing a button that opens a dialog with all Github checks.
 *
 * @param {Object} props - The component props.
 * @param {Array} props.checks - Array of checks to be displayed.
 * @return {JSX.Element} A button to open a dialog with all checks.
 */
function GithubChecks({checks}) {
  const classes = useStyles();
  const [openDialog, setOpenDialog] = useState(false);

  const handleClickOpen = () => {
    setOpenDialog(true);
  };

  const handleClose = () => {
    setOpenDialog(false);
  };

  return (
    <>
      <Button
        variant="contained"
        className={classes.checksButton}
        onClick={handleClickOpen}
        startIcon={<MarkGithubIcon size={16}/>}
        aria-label="show all checks"
      >
        Show all checks
      </Button>
      <ChecksDialog open={openDialog} onClose={handleClose} checks={checks} />
    </>
  );
}

GithubChecks.propTypes = {
  checks: PropTypes.array.isRequired,
};

export default GithubChecks;
