import {useState, useEffect} from "react";
import {collection, query, where, onSnapshot} from "firebase/firestore";
import {db} from "../firebase";

/**
 * Custom hook to fetch all libraries for a given release from Firestore.
 *
 * @param {string} releaseId - The ID of the release.
 * @return {Array} The libraries of the release.
 */
function useLibraries(releaseId) {
  const [libraries, setLibraries] = useState([]);

  useEffect(() => {
    const librariesCollection = collection(db, "libraries");
    const librariesQuery = query(
        librariesCollection, where("releaseID", "==", releaseId),
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

export default useLibraries;
