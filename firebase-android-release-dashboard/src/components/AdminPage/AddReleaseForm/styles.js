import {makeStyles} from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  addReleaseButton: {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    padding: theme.spacing(1),
  },
  addIcon: {
    verticalAlign: "middle",
    marginRight: theme.spacing(0.5),
    marginLeft: theme.spacing(0.5),
  },
  addReleaseButtonText: {
    verticalAlign: "middle",
    textTransform: "none",
    height: "24px",
    lineHeight: "24px",
  },
}));

export default useStyles;
