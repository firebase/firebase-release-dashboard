import {makeStyles} from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  appBar: {
    display: "flex",
    justifyContent: "space-between",
    padding: theme.spacing(0),
    backgroundColor: theme.palette.background.white,
  },
  // https://firebase.google.com/brand-guidelines/
  logo: {
    width: "32px",
    height: "32px",
  },
  title: {
    padding: theme.spacing(1),
    flexGrow: 1,
    fontWeight: 500,
  },
  button: {
    textTransform: "none",
    color: theme.palette.primary.main,
    backgroundColor: theme.palette.primary.contrastText,
  },
  modal: {
    content: {
      top: "50%",
      left: "50%",
      right: "auto",
      bottom: "auto",
      marginRight: "-50%",
      transform: "translate(-50%, -50%)",
      border: "none",
      width: "auto",
      height: "auto",
      overflow: "auto",
      padding: 0,
      background: "transparent",
    },
  },
}));

export default useStyles;

