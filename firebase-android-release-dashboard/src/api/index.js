import axios from "axios";
import {auth} from "../firebase";
import {
  ADD_RELEASES_URL,
  DELETE_RELEASE_URL,
  MODIFY_RELEASE_URL,
  REFRESH_RELEASE_URL,
  GET_RELEASES_URL,
} from "./constants";
import {format} from "date-fns";

const API_DATE_FORMAT = "yyyy-MM-dd";

/**
 * Add new releases
 *
 * This request is only authorized for administrators.
 *
 * @param {string} releases - The releases to add to Firestore.
 * @return {Promise<Object>} - Response object.
 */
async function addReleases(releases) {
  const token = await auth.currentUser.getIdToken();
  const response = await axios.post(
      ADD_RELEASES_URL, // TODO: Update URL
      {
        releases: releases,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
      },
  );

  return response;
};

/**
 * Delete a release and all its associated data in Firestore.
 *
 * This request is only authorized for administrators.
 *
 * @param {string} releaseId
 * @return {Promise<Object>} - Response object.
 */
async function deleteRelease(releaseId) {
  const token = await auth.currentUser.getIdToken();
  const response = await axios.post(DELETE_RELEASE_URL,
      {
        releaseId: releaseId,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
      });

  return response;
};

/**
 * Refresh a release and all its associated data in Firestore.
 *
 * This request is only authorized for administrators.
 *
 * @param {string} releaseId
 * @return {Promise<Object>} - Response object.
 */
async function refreshRelease(releaseId) {
  const token = await auth.currentUser.getIdToken();
  const response = await axios.post(REFRESH_RELEASE_URL, {
    releaseId: releaseId,
  },
  {
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });

  return response;
};

/**
 * Refresh a release and all its associated data in Firestore.
 *
 * This request is only authorized for administrators.
 *
 * @param {string} releaseId - The ID of the release to modify.
 * @param {string} releaseName - The new name of the release.
 * @param {string} releaseBranchName - The new name of the release branch.
 * @param {string} releaseOperator - The new operator of the release.
 * @param {Date} codeFreezeDate - The new code freeze date of the release.
 * @param {Date} releaseDate - The new release date of the release.
 * @param {boolean} isReleased - Whether the release is released.
 * @return {Promise<Object>} - Response object.
 */
async function modifyRelease(
    releaseId,
    releaseName,
    releaseBranchName,
    releaseOperator,
    codeFreezeDate,
    releaseDate,
    isReleased,
) {
  const token = await auth.currentUser.getIdToken();
  const response = await axios.post(MODIFY_RELEASE_URL, {
    releaseId: releaseId,
    release: {
      releaseName: releaseName,
      releaseBranchName: releaseBranchName,
      releaseOperator: releaseOperator,
      codeFreezeDate: format(codeFreezeDate, API_DATE_FORMAT),
      releaseDate: format(releaseDate, API_DATE_FORMAT),
      isReleased: isReleased,
    },
  },
  {
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });

  return response;
};

/**
 * Refresh a release and all its associated data in Firestore.
 *
 * This request is only authorized for administrators.
 *
 * @return {Promise<Object>} - Response object.
 */
async function getReleases() {
  const response = await axios.get(GET_RELEASES_URL, {});
  return response;
};

export {addReleases, deleteRelease, refreshRelease, modifyRelease, getReleases};
