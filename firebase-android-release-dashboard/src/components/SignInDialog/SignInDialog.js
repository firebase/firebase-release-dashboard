import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  TextField} from "@material-ui/core";
import {Alert} from "@material-ui/lab";
import {signInWithEmailAndPassword} from "firebase/auth";
import PropTypes from "prop-types";
import React, {useState} from "react";
import {auth} from "../../firebase";
import useStyles from "./styles";

/**
 * SignInDialog component is used to provide a sign-in form dialog to the user.
 * It takes the open, onClose, and onSuccess as props to control the dialog
 * and handle successful user sign in.
 *
 * @param {Object} props - Props passed to the component.
 * @param {boolean} props.open - State to control the dialog display.
 * @param {function} props.onClose - Function to control closing of the dialog.
 * @param {function} props.onSuccess - Function to execute after successful sign
 * in.
 * @return {JSX.Element} Rendered SignInDialog component.
 */
function SignInDialog({open, onClose, onSuccess}) {
  const classes = useStyles();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

  const getErrorMessage = (errorCode) => {
    switch (errorCode) {
      case "auth/wrong-password":
        return "Incorrect password.";
      case "auth/user-not-found":
        return "Email is not recognized.";
      default:
        return "Sign-in failed. Please try again.";
    }
  };

  const signIn = async (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const handleSignIn = async (event) => {
    event.preventDefault(); // Prevents default form submission
    try {
      await signIn(email, password);
      setError(null);
      onSuccess();
    } catch (error) {
      setError(getErrorMessage(error.code));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} aria-labelledby="sign-in-dialog">
      <DialogTitle
        className={classes.dialogTitle}
      >
        Administrator Sign In
      </DialogTitle>
      <DialogContent className={classes.dialogContent}>
        {error && (
          <Alert severity="error" className={classes.error}>
            {error}
          </Alert>
        )}
        <form className={classes.form} onSubmit={handleSignIn}>
          <TextField
            label="Email"
            variant="outlined"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Password"
            variant="outlined"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button
            type="submit"
            variant="contained"
            className={classes.button}>
            Sign in
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

SignInDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func.isRequired,
};

export default SignInDialog;
