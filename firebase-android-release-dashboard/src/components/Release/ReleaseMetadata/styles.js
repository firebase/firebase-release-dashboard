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
});

export default useStyles;
