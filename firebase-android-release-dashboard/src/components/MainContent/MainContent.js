import {
  Box,
  Container,
  Paper,
} from "@material-ui/core";
import React, {useState} from "react";
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
  const [modalOpen, setModalOpen] = useState(false);
  const classes = useStyles();

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
        />
        <ReleaseList />
      </Container>
    </Box>
  );
}

export default MainContent;
