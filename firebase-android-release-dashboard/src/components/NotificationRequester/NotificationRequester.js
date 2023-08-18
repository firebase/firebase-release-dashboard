import {useEffect} from "react";

/**
 * Component that requests permission to send notifications when mounted.
 *
 * @return {JSX.Element}
 */
function NotificationRequester() {
  useEffect(() => {
    if ("Notification" in window) {
      Notification.requestPermission();
    }
  }, []);

  return null; // This component doesn't render anything
};

export default NotificationRequester;
