import {useState, useEffect} from "react";
import {collection, query, where, onSnapshot} from "firebase/firestore";
import {db} from "../firebase";

/**
 * Custom hook to fetch all releasing libraries for a given release
 * from Firestore. Releasing libraries are libraries that are not
 * opted out of the release.
 *
 * @param {string} releaseId - The ID of the release.
 * @return {Array} The libraries of the release.
 */
function useReleasingLibraries(releaseId) {
  const [libraries, setLibraries] = useState([]);

  useEffect(() => {
    const librariesCollection = collection(db, "libraries");
    const librariesQuery = query(
        librariesCollection,
        where("releaseID", "==", releaseId),
        where("optedOut", "==", false),
    );

    const unsubscribe = onSnapshot(librariesQuery, (snapshot) => {
      const newLibraries = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setLibraries(newLibraries);
    });

    // Clean up the onSnapshot listener when the component is unmounted
    return () => unsubscribe();
  }, [releaseId]);

  return libraries;
}

export default useReleasingLibraries;
