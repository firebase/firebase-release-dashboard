import {makeStyles} from "@material-ui/core/styles";
import theme from "../../../config/theme";

const useStyles = makeStyles({
  metadata: {
    justifyContent: "space-between",
    marginBottom: theme.spacing(1),
  },
  metadataItem: {
    flex: "1 0 20%",
    textAlign: "left",
  },
  stateChip: {
    padding: theme.spacing(0.5),
    color: theme.palette.primary.contrastText,
    fontWeight: 450,
  },
});

export default useStyles;
