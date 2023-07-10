import {useState, useEffect} from "react";
import {auth} from "../firebase";

/**
 * Custom React hook to handle Firebase authentication state.
 *
 * @return {Object} An object containing the authentication state and the
 * setter function.
 */
export function useAuthentication() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const unregisterAuthObserver = auth.onAuthStateChanged((user) => {
      setIsLoggedIn(!!user);
    });

    return unregisterAuthObserver; // Make sure we un-register Firebase
    // observers when the component unmounts.
  }, []);

  return {isLoggedIn, setIsLoggedIn};
}
