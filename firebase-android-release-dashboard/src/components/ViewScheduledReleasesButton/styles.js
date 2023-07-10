import {makeStyles} from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  scheduledReleasesButton: {
    textTransform: "none",
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
  },
  scheduleIcon: {
    marginRight: theme.spacing(0.5),
  },
}));

export default useStyles;
