import {makeStyles} from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  buildArtifactIcon: {
    marginRight: theme.spacing(0.5),
  },
  buildArtifactLink: {
    fontSize: theme.typography.pxToRem(16),
  },
  disabledBuildArtifacts: {
    fontSize: theme.typography.pxToRem(20),
    fontWeight: "normal",
    color: "grey",
  },
}));

export default useStyles;
