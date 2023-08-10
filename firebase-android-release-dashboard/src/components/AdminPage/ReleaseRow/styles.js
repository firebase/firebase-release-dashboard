import {makeStyles} from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  tableRow: {
    "&:hover": {
      backgroundColor: theme.palette.action.hover, // hover effect
    },
  },
}));

export default useStyles;
