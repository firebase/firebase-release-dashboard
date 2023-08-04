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
      let updatedReleases = [];

      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data();
        const id = change.doc.id;

        // Only process modified documents.
        if (previousStates.current.hasOwnProperty(id) &&
          (change.type === "modified" &&
            (previousStates.current[id] !== data.state))) {
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

      setReleasesWithStateUpdates(updatedReleases);
    });

    // Clean up the onSnapshot listener when the component is unmounted
    return () => unsubscribe();
  }, []); // Empty array to ensure the effect only runs once on component mount

  return releasesWithStateUpdates;
}

export default useReleaseStateUpdates;
