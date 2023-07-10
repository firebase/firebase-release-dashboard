import {Masonry} from "@mui/lab";
import PropTypes from "prop-types";
import React from "react";
import ReleaseLibraryItem from "../ReleaseLibraryItem";

/**
 * Release renders the details of a single release.
 *
 * @param {Array} libraries - The details of the release to render.
 * @return {JSX.Element}
 */
function ReleaseLibraries({libraries}) {
  return (
    <Masonry columns={2} spacing={1}>
      {libraries.map((library, index) => (
        <ReleaseLibraryItem library={library} key={index} />
      ))}
    </Masonry>
  );
}

ReleaseLibraries.propTypes = {
  libraries: PropTypes.array.isRequired,
};

export default ReleaseLibraries;
