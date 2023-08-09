import {makeStyles} from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  stateChip: (props) => ({
    backgroundColor: props.backgroundColor,
    color: props.color,
    padding: theme.spacing(0.5),
    color: theme.palette.primary.contrastText,
    fontWeight: 450,
  }),
}));

export default useStyles;
