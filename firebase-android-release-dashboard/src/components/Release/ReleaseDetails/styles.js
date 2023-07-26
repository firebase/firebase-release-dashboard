import {makeStyles} from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  releaseBranchIcon: {
    marginRight: theme.spacing(0.5),
    color: theme.palette.text.primary,
  },
  externalLink: {
    marginLeft: theme.spacing(0),
  },
}));

export default useStyles;
