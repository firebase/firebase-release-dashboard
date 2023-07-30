import {useState, useEffect} from "react";
import {collection, query, where, onSnapshot} from "firebase/firestore";
import {db} from "../firebase";

/**
 * Custom hook to fetch all checks for a given release from Firestore.
 *
 * @param {string} releaseId - The ID of the release.
 * @return {Array} The checks of the release.
 */
function useChecks(releaseId) {
  const [checks, setChecks] = useState([]);

  useEffect(() => {
    const checksCollection = collection(db, "checks");
    const checksQuery = query(
        checksCollection, where("releaseID", "==", releaseId),
    );

    const unsubscribe = onSnapshot(checksQuery, (snapshot) => {
      const newChecks = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setChecks(newChecks);
    });

    // Clean up the onSnapshot listener when the component is unmounted
    return () => unsubscribe();
  }, [releaseId]);

  return checks;
}

export default useChecks;
