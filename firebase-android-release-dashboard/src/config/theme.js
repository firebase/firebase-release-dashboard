import {createTheme} from "@material-ui/core";
import {blue, green, grey, orange, purple, red} from "@material-ui/core/colors";
import {firebaseColors} from "./colors";

const theme = createTheme({
  typography: {
    fontFamily: "\"Google Sans\", Arial, sans-serif",
    h6: {
      // fontSize: "16px",
      fontFamily: "\"Google Sans\", Arial, sans-serif",
    },
    body1: {
      // fontSize: "14px",
      fontFamily: "\"Roboto\", Arial, sans-serif",
    },
    body2: {
      // fontSize: "12px",
      fontFamily: "\"Roboto\", Arial, sans-serif",
    },
    subtitle1: {
      fontFamily: "\"Google Sans\", Arial, sans-serif",
      // fontSize: "16px",
      // fontWeight: 400,
    },
    subtitle2: {
      fontFamily: "\"Google Sans\", Arial, sans-serif",
      // fontSize: "20px",
      // fontWeight: 300,
    },
  },
  palette: {
    text: {
      primary: grey[800],
      secondary: grey[600],
    },
    primary: {
      main: firebaseColors.googleBlue1,
      light: firebaseColors.googleBlue2,
      dark: firebaseColors.firebaseNavy,
      contrastText: "#ffffff",
    },
    secondary: {
      main: firebaseColors.firebaseOrange,
      light: firebaseColors.firebaseYellow,
      dark: firebaseColors.firebaseOrange,
    },
    background: {
      default: grey[200],
      light: grey[50],
      white: "#ffffff",
    },
    icon: {
      dark: grey[900],
    },
    chip: {
      error: red[400],
      blue: blue[400],
      green: green[400],
      purple: purple[400],
      orange: orange[400],
      gray: grey[400],
    },
  },
});

export default theme;
