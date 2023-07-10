import {makeStyles} from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  form: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
  },
  dialogContent: {
    width: 500,
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
