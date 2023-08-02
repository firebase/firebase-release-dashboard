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
  checkLink: {
    textDecoration: "none",
    color: "inherit",
  },
  githubIcon: {
    color: "#24292e",
    marginRight: "8px",
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
