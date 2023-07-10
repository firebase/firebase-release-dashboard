import React from "react";
import PropTypes from "prop-types";
import {Link, Typography} from "@material-ui/core";
import {PackageIcon} from "@primer/octicons-react";
import useStyles from "./styles.js";

/**
 * BuildArtifacts component renders the build artifact status and provides a
 * link if available.
 *
 * @param {Object} props - The component's props.
 * @param {string} props.buildArtifactStatus - The status of the build
 * artifacts.
 * @param {string} props.buildArtifactConclusion - The conclusion of
 * the build artifacts.
 * @param {string} props.buildArtifactLink - The link to the build artifacts.
 * @return {JSX.Element} The rendered component.
 */
function BuildArtifacts({
  buildArtifactStatus,
  buildArtifactConclusion,
  buildArtifactLink}) {
  const classes = useStyles();

  const isArtifactAvailable =
    buildArtifactStatus === "completed" &&
    buildArtifactConclusion === "success";
  const artifactClass = isArtifactAvailable ?
    classes.enabledBuildArtifacts : classes.disabledBuildArtifacts;
  const artifactText = isArtifactAvailable ?
    "Build Release Artifacts Job" : "Build Release Artifacts Unavailable";

  return (
    <div className={artifactClass}>
      {isArtifactAvailable ? (
        <Link href={buildArtifactLink} rel="noopener noreferrer">
          <Typography
            color="textPrimary"
            variant="body1"
            className={classes.buildArtifactLink}
          >
            <PackageIcon
              size={24}
              className={classes.buildArtifactIcon}
              aria-label="Package Icon"
            />
            {artifactText}
          </Typography>
        </Link>
      ) : (
        <Typography
          color="textSecondary"
          variant="body1"
          className={classes.libraryName}
        >
          <PackageIcon
            size={24}
            className={classes.buildArtifactIcon}
            aria-label="Package Icon"
          />
          {artifactText}
        </Typography>
      )}
    </div>
  );
}

BuildArtifacts.propTypes = {
  buildArtifactStatus: PropTypes.oneOf(["completed", "in_progress", "queued"])
      .isRequired,
  buildArtifactConclusion: PropTypes.oneOf(
      ["success", "failure", "neutral", "cancelled", "skipped",
        "timed_out", "action_required"],
  ).isRequired,
  buildArtifactLink: PropTypes.string.isRequired,
};

export default BuildArtifacts;
