const functions = require("firebase-functions/v2");
const admin = require("firebase-admin");
const {initializeApp} = require("firebase-admin/app");
initializeApp({
  credential: admin.credential.applicationDefault(),
});
const {
  addReleases,
  refreshRelease,
  getReleases,
  modifyReleases,
} = require("./handlers/handlers.js");
const {defineSecret} = require("firebase-functions/params");
const GITHUB_TOKEN = defineSecret("GITHUB_TOKEN");

exports.addReleases = functions.https.onRequest(
    {secrets: [GITHUB_TOKEN]},
    addReleases);
exports.getReleases = functions.https.onRequest(getReleases);
exports.modifyReleases = functions.https.onRequest(
    {secrets: [GITHUB_TOKEN]},
    modifyReleases);
exports.refreshRelease = functions.https.onRequest(
    {secrets: [GITHUB_TOKEN]},
    refreshRelease);
