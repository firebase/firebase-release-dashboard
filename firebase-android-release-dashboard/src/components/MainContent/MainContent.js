import {
  Box,
  Container,
  Paper,
} from "@material-ui/core";
import PropTypes from "prop-types";
import React, {useEffect, useState} from "react";
import releases from "../../releases.json";
import {RELEASE_STATES} from "../../utils/releaseStates";
import {processReleases} from "../../utils/releases";
import ReleaseList from "../ReleaseList/ReleaseList";
import ScheduledReleasesModal from "../ScheduledReleasesModal";
import useStyles from "./styles";
import ViewScheduledReleasesButton from
  "../ViewScheduledReleasesButton/ViewScheduledReleasesButton";

/**
 * MainContent displays a search bar and a list of releases.
 *
 * @param {Object[]} props.releases - The list of releases to display.
 * @return {JSX.Element}
 */
function MainContent() {
  const classes = useStyles();
  const [processedReleases, setProcessedReleases] = useState([]);
  const [scheduledReleases, setScheduledReleases] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const scheduled = releases
        .filter((release) => release.state === RELEASE_STATES.SCHEDULED);
    const nonScheduled = releases
        .filter((release) => release.state !== RELEASE_STATES.SCHEDULED);

    setScheduledReleases(scheduled);
    setProcessedReleases(processReleases(nonScheduled));
  }, [releases]);

  const handleOpen = () => {
    setModalOpen(true);
  };

  const handleClose = () => {
    setModalOpen(false);
  };

  return (
    <Box
      className={classes.backdrop}
    >
      <Container
        component={Paper}
        className={classes.paper}
      >
        <ViewScheduledReleasesButton onClick={handleOpen} />
        <ScheduledReleasesModal
          open={modalOpen}
          handleClose={handleClose}
          scheduledReleases={scheduledReleases}
        />
        <ReleaseList releases={processedReleases} />
      </Container>
    </Box>
  );
}

MainContent.propTypes = {
  releases: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default MainContent;
