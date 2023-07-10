/**
 * Process the release data.
 *
 * Iterates over each release and its libraries. If a library ends with
 * "/ktx", it flags all the changes of the library as Kotlin changes.
 * Then, it finds the root library of the Kotlin library and merges
 * their changes. Finally, it removes the Kotlin library from the release.
 *
 * @param {Array} releases - The array of release objects to process.
 * The release object should be passed as it's received from the
 * API request to the backend.
 * @return {Array} The processed releases with merged changes and
 * without Kotlin libraries.
 */
export const processReleases = (releases) => {
  const releasesCopy = JSON.parse(JSON.stringify(releases));

  return releasesCopy.map((release) => {
    const kotlinLibraries = release.libraries
        .filter((lib) => lib.libraryName.endsWith("/ktx"));
    const nonKotlinLibraries = release.libraries
        .filter((lib) => !lib.libraryName.endsWith("/ktx"));

    kotlinLibraries.forEach((kotlinLib) => {
      kotlinLib.changes.forEach((change) => change.kotlin = true);

      const rootLibraryName = kotlinLib.libraryName.split("/")[0];
      const rootLibrary = nonKotlinLibraries
          .find((lib) => lib.libraryName === rootLibraryName);

      if (rootLibrary) {
        rootLibrary.changes = rootLibrary.changes.concat(kotlinLib.changes);
      }
    });

    return {...release, libraries: nonKotlinLibraries};
  });
};
