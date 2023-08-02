import {useState, useEffect} from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import {db} from "../firebase";

/**
 * Custom hook to fetch all releases from Firestore.
 * An optional filter by state can be provided.
 *
 * @param {string} stateFilter - The state to filter releases by.
 * @param {string} excludeState - The state to exclude releases by.
 * @return {Array} The releases.
 */
function useReleases(stateFilter, excludeState) {
  const [releases, setReleases] = useState([]);

  useEffect(() => {
    const releasesCollection = collection(db, "releases");
    let releasesQuery = query(
        releasesCollection, orderBy("releaseDate", "desc"),
    );

    // If a stateFilter is provided, modify the query to filter by state
    if (stateFilter) {
      releasesQuery = query(
          releasesCollection,
          where("state", "==", stateFilter), orderBy("releaseDate", "desc"),
      );
    }

    const unsubscribe = onSnapshot(releasesQuery, (snapshot) => {
      let newReleases = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        // Convert Firestore Timestamp to JS Date object
        releaseDate: doc.data().releaseDate.toDate(),
        codeFreezeDate: doc.data().codeFreezeDate.toDate(),
      }));

      // If excludeState is provided and stateFilter is not provided
      // filter out releases with that state
      if (excludeState && !stateFilter) {
        newReleases = newReleases
            .filter((release) => release.state !== excludeState);
      }

      setReleases(newReleases);
    });

    // Clean up the onSnapshot listener when the component is unmounted
    return () => unsubscribe();
  }, [stateFilter]); // Re-run the effect when stateFilter changes

  return releases;
}

export default useReleases;
