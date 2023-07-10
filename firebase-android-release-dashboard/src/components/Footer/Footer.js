import React from "react";
import {Container, Typography} from "@material-ui/core";
import {makeStyles} from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  footer: {
    padding: theme.spacing(2),
    margin: "auto",
    textAlign: "center",
  },
}));

/**
 * A stateless functional component that serves as the Footer of the application
 *
 * @return {JSX.Element} A Material UI Container component representing the
 * footer
 */
function Footer() {
  const classes = useStyles();

  return (
    <Container component="footer" className={classes.footer}>
      <Typography variant="subtitle1">
        Support
      </Typography>
    </Container>
  );
}

export default Footer;
