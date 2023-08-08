import {makeStyles} from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  releaseButtonIcon: {
    alignContent: "center",
  },
  releaseButtonText: {
    textTransform: "none",
    minWidth: "130px",
  },
  emphasizedButton: {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
  },
  unemphasizedButton: {
    backgroundColor: theme.palette.primary.disabled,
    color: theme.palette.primary.contrastText,
  },
}));

export default useStyles;
