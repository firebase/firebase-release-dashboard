import {makeStyles} from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  backdrop: {
    backgroundColor: theme.palette.background.default,
    minHeight: "100vh",
    alignItems: "center",
    justifyContent: "center",
    display: "flex",
  },
  paper: {
    padding: "16px",
    backgroundColor: theme.palette.background.light,
    maxWidth: "70vw",
  },
}));

export default useStyles;
