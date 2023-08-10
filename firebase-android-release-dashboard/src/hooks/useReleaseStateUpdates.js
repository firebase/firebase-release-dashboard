import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import {useEffect, useRef, useState} from "react";
import {db} from "../firebase";

/**
 * Custom hook to get releases with state updates.
 *
 * This hook uses the Firestore onSnapshot listener to get updates to the
 * releases collection. It then filters the updates to only include releases
 * that have had their state changed.
 *
 * @return {Array} The releases with state updates
 */
function useReleaseStateUpdates() {
  const [releasesWithStateUpdates, setReleasesWithStateUpdates] = useState([]);
  const previousStates = useRef({});

  useEffect(() => {
    const releasesCollection = collection(db, "releases");
    const releasesQuery = query(releasesCollection,
        orderBy("releaseDate", "desc"));

    const unsubscribe = onSnapshot(releasesQuery, (snapshot) => {
      const updatedReleases = getReleasesWithStateUpdates(
          snapshot,
          previousStates,
      );
      setReleasesWithStateUpdates(updatedReleases);
    });

    // Clean up the onSnapshot listener when the component is unmounted
    return () => unsubscribe();
  }, []); // Empty array to ensure the effect only runs once on component mount

  return releasesWithStateUpdates;
}

/**
 * Retrieve the releases with state updates from the snapshot.
 *
 * @param {Object} snapshot The snapshot of the releases collection
 * @param {Object} previousStates The previous states of the releases
 * @return {Array} The updated releases
 */
function getReleasesWithStateUpdates(snapshot, previousStates) {
  let updatedReleases = [];

  snapshot.docChanges().forEach((change) => {
    const data = change.doc.data();
    const id = change.doc.id;

    const stateWasModified = previousStates.current.hasOwnProperty(id) &&
      (change.type === "modified" && previousStates.current[id] !== data.state);

    // Only process modified documents
    if (stateWasModified) {
      // Update releases
      updatedReleases = [
        ...updatedReleases.filter((release) => release.id !== id),
        {
          id,
          ...data,
          // Convert Firestore Timestamp to JS Date object
          releaseDate: data.releaseDate.toDate(),
          codeFreezeDate: data.codeFreezeDate.toDate(),
        },
      ];
    }

    if (change.type == "modified" || change.type == "added") {
      previousStates.current[id] = data.state;
    }
  });

  return updatedReleases;
}

export default useReleaseStateUpdates;
