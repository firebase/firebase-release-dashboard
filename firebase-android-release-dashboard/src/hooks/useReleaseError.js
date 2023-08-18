import {
  collection, limit, onSnapshot,
  orderBy, query, where,
} from "firebase/firestore";
import {useEffect, useState} from "react";
import {db} from "../firebase";

/**
 * Custom React hook to manage the state and side effects for fetching the
 * most recent release error.
 *
 * We accept the isLoggedIn parameter to prevent the hook from fetching
 * release errors when the user is not logged in. Conveniently, this also
 * triggers the hook to fetch the release error when the user logs in.
 *
 * @param {string} id - The ID of the release to fetch errors for.
 * @param {boolean} isLoggedIn - Whether the user is logged in.
 * @return {Object} The most recent release error state.
 */
function useRecentReleaseError(id, isLoggedIn) {
  const [releaseError, setReleaseError] = useState(null);

  useEffect(() => {
    if (isLoggedIn) {
      // Get the most recent release error for the release
      const q = query(
          collection(db, "releaseError"),
          where("releaseID", "==", id),
          orderBy("timestamp", "asc"),
          limit(1),
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs;
        if (docs.length) {
          const doc = docs[0];
          const data = doc.data();
          setReleaseError({
            id: doc.id,
            ...data,
            // Convert Firestore Timestamp to JS Date object
            timestamp: data.timestamp.toDate(),
          });
        } else {
          setReleaseError(null);
        }
      });

      // Clean up the onSnapshot listener when the component is unmounted
      return () => unsubscribe();
    } else {
      // If user is not logged in, we set releaseError to null
      setReleaseError(null);
    }
  }, [id, isLoggedIn]);

  return releaseError;
}

export default useRecentReleaseError;
