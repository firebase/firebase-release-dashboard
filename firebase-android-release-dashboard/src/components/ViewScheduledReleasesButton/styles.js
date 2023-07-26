import {makeStyles} from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  scheduledReleasesButton: {
    padding: theme.spacing(1),
  },
  scheduleIcon: {
    verticalAlign: "middle",
    marginRight: theme.spacing(0.5),
  },
  scheduledReleasesButtonText: {
    textTransform: "none",
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    height: "24px",
  },
}));

export default useStyles;
