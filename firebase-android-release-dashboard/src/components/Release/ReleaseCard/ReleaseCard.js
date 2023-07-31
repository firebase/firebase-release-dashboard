import {Card, CardContent, Divider} from "@material-ui/core";
import PropTypes from "prop-types";
import React from "react";
import useRelease from "../../../hooks/useRelease";
import ReleaseDetails from "../ReleaseDetails";
import ReleaseMetadata from "../ReleaseMetadata";
import useStyles from "./styles.js";

/**
 * The ReleaseCard component renders a card containing the metadata
 * and details of a release.
 *
 * The release is fetched from Firestore using the useRelease hook.
 * We don't pass the whole release as a prop to the ReleaseCard
 * component because we want to be able to have the component
 * re-render when the release changes.
 *
 * @param {Object} releaseId - The id of the release to render.
 * @return {JSX.Element} The rendered component.
 */
function ReleaseCard({releaseId}) {
  const classes = useStyles();
  const release = useRelease(releaseId);

  if (!release) {
    return null;
  }

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
  releaseId: PropTypes.any.isRequired,
};

export default ReleaseCard;
