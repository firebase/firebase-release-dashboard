import {makeStyles} from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  table: {
    minWidth: 650,
  },
  tableContainer: {
    borderRadius: 5,
    backgroundColor: theme.palette.background.paper,
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
    maxWidth: "90vw",
    boxShadow: theme.shadows[2],
  },
  container: {
    display: "flex",
    justifyContent: "center",
  },
  tableHeader: {
    fontWeight: theme.typography.fontWeightBold,
  },
}));

export default useStyles;
