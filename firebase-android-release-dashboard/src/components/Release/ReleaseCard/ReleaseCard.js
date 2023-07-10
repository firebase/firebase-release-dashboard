import {Card, CardContent, Divider} from "@material-ui/core";
import PropTypes from "prop-types";
import React from "react";
import ReleaseDetails from "../ReleaseDetails";
import ReleaseMetadata from "../ReleaseMetadata";
import useStyles from "./styles.js";

/**
 * The ReleaseCard component renders a card containing the metadata
 * and details of a release.
 *
 * @param {Object} release - The details of the release to render.
 * @throws {Error} If the release state is not recognized.
 *
 * @return {JSX.Element} The rendered component.
 */
function ReleaseCard({release}) {
  const classes = useStyles();

  return (
    <Card className={classes.root}>
      <CardContent>
        <ReleaseMetadata release={release} />
        <Divider />
        <ReleaseDetails release={release} />
      </CardContent>
    </Card>
  );
}

ReleaseCard.propTypes = {
  release: PropTypes.shape({
    state: PropTypes.string.isRequired,
    libraries: PropTypes.arrayOf(PropTypes.shape({
      libraryName: PropTypes.string.isRequired,
    })).isRequired,
    checks: PropTypes.arrayOf(PropTypes.object).isRequired,
    buildArtifactStatus: PropTypes.string,
    buildArtifactConclusion: PropTypes.string,
    buildArtifactLink: PropTypes.string,
  }).isRequired,
};

export default ReleaseCard;
