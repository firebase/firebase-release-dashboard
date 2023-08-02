import {makeStyles} from "@material-ui/core/styles";
import theme from "../../../config/theme";

const useStyles = makeStyles({
  libraryPaper: {
    padding: theme.spacing(1),
    margin: theme.spacing(1),
    width: "100%",
    border: "none",
    textAlign: "left",
  },
  icon: {
    color: theme.palette.icon.dark,
    marginRight: theme.spacing(1),
  },
});

export default useStyles;

