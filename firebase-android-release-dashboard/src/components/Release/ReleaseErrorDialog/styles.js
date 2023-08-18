import {makeStyles} from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  stackTrace: {
    fontFamily: "monospace",
    fontSize: "0.8rem",
    color: theme.palette.errorText,
    whiteSpace: "pre-wrap",
  },
}));

export default useStyles;
