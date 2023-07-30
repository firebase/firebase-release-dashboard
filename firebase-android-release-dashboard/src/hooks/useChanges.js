import {useState, useEffect} from "react";
import {collection, query, where, onSnapshot} from "firebase/firestore";
import {db} from "../firebase";

/**
 * Custom hook to fetch all changes for a given library from Firestore.
 *
 * @param {string} libraryID - The ID of the library to fetch changes for.
 * @return {Array} The changes.
 */
function useChanges(libraryID) {
  const [changes, setChanges] = useState([]);

  useEffect(() => {
    const changesCollection = collection(db, "changes");
    const changesQuery = query(
        changesCollection, where("libraryID", "==", libraryID),
    );

    const unsubscribe = onSnapshot(changesQuery, (snapshot) => {
      const newChanges = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setChanges(newChanges);
    });

    // Clean up the onSnapshot listener when the component is unmounted
    return () => unsubscribe();
  }, [libraryID]); // Re-run the effect when libraryID changes

  return changes;
}

export default useChanges;
