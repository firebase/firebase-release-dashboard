import {makeStyles} from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  form: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
  },
  dialogTitle: {
    paddingBottom: 0,
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
  },
  dialogContent: {
    width: 500,
    paddingBottom: theme.spacing(2),
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
  },
  button: {
    marginTop: theme.spacing(2),
    color: theme.palette.primary.contrastText,
    backgroundColor: theme.palette.primary.main,
  },
  error: {
    marginBottom: theme.spacing(2),
  },
}));

export default useStyles;
