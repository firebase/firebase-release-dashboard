import {makeStyles} from "@material-ui/core";

const useStyles = makeStyles({
  listItem: {
    paddingTop: "4px",
    paddingBottom: "4px",
  },
  listItemIcon: {
    minWidth: "auto",
    marginRight: "8px",
  },
  iconButton: {
    padding: "5px",
  },
  githubIcon: {
    color: "#24292e",
  },
  successIcon: {
    color: "#28a745",
  },
  failIcon: {
    color: "#cb2431",
  },
  pendingIcon: {
    color: "#dbab09",
  },
});

export default useStyles;
