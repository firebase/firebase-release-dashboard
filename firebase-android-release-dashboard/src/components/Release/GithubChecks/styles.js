import {makeStyles} from "@material-ui/core/styles";
import theme from "../../../config/theme";

const useStyles = makeStyles({
  checksButton: {
    textTransform: "none",
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
  },
});

export default useStyles;
