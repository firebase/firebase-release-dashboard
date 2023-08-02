import React, {useState} from "react";
import PropTypes from "prop-types";
import {
  AppBar,
  Button,
  Toolbar,
  Typography,
} from "@material-ui/core";
import Modal from "react-modal";

import {auth} from "../../firebase";
import firebaseLogo from "../../assets/logo.svg";
import SignInDialog from "../SignInDialog";
import useStyles from "./styles";

Modal.setAppElement("#root");

/**
 * Header component for displaying the application header and user
 * authentication actions.
 *
 * @param {boolean} isLoggedIn - Represents user's login state.
 * @param {function} setIsLoggedIn - Function to change user's login state.
 * @return {JSX.Element} Returns the Header component.
 */
function Header({isLoggedIn, setIsLoggedIn}) {
  const classes = useStyles();
  const [modalIsOpen, setModalIsOpen] = useState(false);

  const handleSignInSuccess = () => {
    setIsLoggedIn(true);
    setModalIsOpen(false);
  };

  const handleLogin = () => {
    setModalIsOpen(true);
  };

  const handleLogout = () => {
    auth.signOut();
    setIsLoggedIn(false);
  };

  const renderButton = () => {
    return isLoggedIn ? (
      <Button className={classes.button} onClick={handleLogout}>
        Logout
      </Button>
    ) : (
      <Button className={classes.button} onClick={handleLogin}>
        Login
      </Button>
    );
  };

  return (
    <AppBar position="static" className={classes.appBar}>
      <Toolbar>
        <img src={firebaseLogo} alt="Firebase" className={classes.logo}/>
        <Typography variant="h5" color="textPrimary" className={classes.title}>
          Firebase Android Release Dashboard
        </Typography>
        {renderButton()}
      </Toolbar>
      <SignInDialog
        open={modalIsOpen}
        onClose={() => setModalIsOpen(false)}
        onSuccess={handleSignInSuccess}
      />
    </AppBar>
  );
}

Header.propTypes = {
  isLoggedIn: PropTypes.bool.isRequired,
  setIsLoggedIn: PropTypes.func.isRequired,
};

export default Header;
