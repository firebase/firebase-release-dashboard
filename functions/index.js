const functions = require("firebase-functions/v2");
const admin = require("firebase-admin");
const {initializeApp} = require("firebase-admin/app");
initializeApp({
  credential: admin.credential.applicationDefault(),
});
const {
  scheduleReleases,
  refreshRelease,
  getReleases,
  modifyRelease,
} = require("./handlers/handlers.js");
const {defineSecret} = require("firebase-functions/params");
const GITHUB_TOKEN = defineSecret("GITHUB_TOKEN");

exports.scheduleReleases = functions.https.onRequest(scheduleReleases);
exports.getReleases = functions.https.onRequest(getReleases);
exports.modifyRelease = functions.https.onRequest(
    {secrets: [GITHUB_TOKEN]},
    modifyRelease);
exports.refreshRelease = functions.https.onRequest(
    {secrets: [GITHUB_TOKEN]},
    refreshRelease);
