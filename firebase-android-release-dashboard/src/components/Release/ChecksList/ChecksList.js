import {
  Box, Grid,
  IconButton,
  List, ListItem,
  ListItemIcon,
  ListItemText,
} from "@material-ui/core";
import {
  CheckIcon,
  CircleIcon,
  MarkGithubIcon,
  XIcon,
} from "@primer/octicons-react";
import PropTypes from "prop-types";
import React from "react";
import useStyles from "./styles";

const STATUS = {
  COMPLETED: "completed",
  PENDING: "pending",
};

const CONCLUSION = {
  SUCCESS: "success",
};

/**
 * Render a list of checks.
 *
 * @param {Object} checkProps - The properties of the check.
 * @param {Array} checkProps.checks - An array of checks to be listed.
 * @return {JSX.Element} The rendered list of checks.
 */
function ChecksList({checks}) {
  const classes = useStyles();

  // Sort the checks so the bad ones are at the top of the list
  const sortedChecks = [...checks].sort((a, b) => {
    if (a.status === STATUS.COMPLETED && a.conclusion !== CONCLUSION.SUCCESS) {
      return -1;
    } else if (b.status === STATUS.COMPLETED &&
      b.conclusion !== CONCLUSION.SUCCESS) {
      return 1;
    } else {
      return 0;
    }
  });

  const checkIcon = (status, conclusion) => {
    if (status === STATUS.COMPLETED) {
      return conclusion === CONCLUSION.SUCCESS ?
        <CheckIcon className={classes.successIcon} /> :
        <XIcon className={classes.failIcon} />;
    } else if (status === STATUS.PENDING) {
      return <CircleIcon className={classes.pendingIcon} />;
    } else {
      return <XIcon className={classes.failIcon} />;
    }
  };

  return (
    <List>
      {sortedChecks.map((check) => (
        <ListItem key={check.id} className={classes.listItem}>
          <ListItemIcon className={classes.listItemIcon}>
            {checkIcon(check.status, check.conclusion)}
          </ListItemIcon>
          <ListItemText
            primary={
              <Grid container alignItems="center">
                <IconButton
                  component="a"
                  href={check.httpsUrl}
                  rel="noopener noreferrer"
                  className={classes.iconButton}
                >
                  <MarkGithubIcon size={16} className={classes.githubIcon} />
                </IconButton>
                <Box flexGrow={1}>
                  {check.name}
                </Box>
              </Grid>
            }
          />
        </ListItem>
      ))}
    </List>
  );
}

ChecksList.propTypes = {
  checks: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    status: PropTypes.string.isRequired,
    conclusion: PropTypes.string.isRequired,
    httpsUrl: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
  })).isRequired,
};

export default ChecksList;
