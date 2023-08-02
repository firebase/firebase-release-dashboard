import {useState, useEffect} from "react";
import {onSnapshot, doc} from "firebase/firestore";
import {db} from "../firebase";

/**
 * Custom React hook to manage the state and side effects for fetching a
 * single release.
 *
 * @param {string} id - The ID of the release to fetch.
 * @return {Object} The release state.
 */
function useRelease(id) {
  const [release, setRelease] = useState(null);

  useEffect(() => {
    const releaseDoc = doc(db, "releases", id);
    const unsubscribe = onSnapshot(releaseDoc, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setRelease({
          id: doc.id,
          ...doc.data(),
          // Convert Firestore Timestamp to JS Date object
          releaseDate: data.releaseDate.toDate(),
          codeFreezeDate: data.codeFreezeDate.toDate(),
        });
      }
    });

    // Clean up the onSnapshot listener when the component is unmounted
    return () => unsubscribe();
  }, [id]);

  return release;
}

export default useRelease;
