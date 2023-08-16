import React, {useEffect} from "react";
import useReleaseStateUpdates from "../../hooks/useReleaseStateUpdates";
import NotificationRequester from "../NotificationRequester";
import {RELEASE_STATES} from "../../utils/releaseStates";

const stateUpdateMesssage = (releaseName, state) => {
  switch (state) {
    case RELEASE_STATES.CODE_FREEZE:
      return `Release ${releaseName} has entered code freeze.`;
    case RELEASE_STATES.RELEASE_DAY:
      return `Release ${releaseName} is scheduled to be released today.`;
    case RELEASE_STATES.RELEASED:
      return `Release ${releaseName} has been released.`;
    case RELEASE_STATES.DELAYED:
      return `Release ${releaseName} has been delayed.`;
    default:
      return `Release ${releaseName} has been updated to ${state}.`;
  }
};
/**
 * Component to display notifications for release state updates.
 *
 * @return {JSX.Element} The rendered ReleaseNotifier component
 */
function ReleaseNotifier() {
  const releasesWithStateUpdates = useReleaseStateUpdates();

  useEffect(() => {
    releasesWithStateUpdates.forEach((release) => {
      if (release.state !== RELEASE_STATES.ERROR &&
        release.state !== RELEASE_STATES.UPCOMING) {
        new Notification("Release Update", {
          body: stateUpdateMesssage(release.releaseName, release.state),
        });
      }
    });
  }, [releasesWithStateUpdates]);

  return (
    <>
      <NotificationRequester />
    </>
  );
}

export default ReleaseNotifier;
