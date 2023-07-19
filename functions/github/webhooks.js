const {
  getReleaseIdFromBranch,
} = require("../database/database.js");
const {
  syncReleaseState,
} = require("../handlers/handlers.js");
const {
  verifySignature,
} = require("./github.js");
const {Octokit} = require("@octokit/rest");
const {error, log} = require("firebase-functions/logger");
const {defineSecret} = require("firebase-functions/params");
const GITHUB_WEBHOOK_SECRET = defineSecret("GITHUB_WEBHOOK_SECRET");
const GITHUB_TOKEN = defineSecret("GITHUB_TOKEN");

/**
  * Handles a GitHub check run event. This function is called when a check run
  * is created, completed, or rerequested. It updates the release state if
  * necessary.
  *
  * @param {Object} req - The request object.
  * @param {Object} res - The response object.
  * @return {Promise} A promise that resolves when the request is complete.
  */
async function githubWebhook(req, res) {
  if (!verifySignature(req, GITHUB_WEBHOOK_SECRET.value())) {
    return res.status(401).send("Unauthorized");
  }

  const payload = req.body;
  const eventType = req.headers["x-github-event"];

  log("Received GitHub webhook", {payload: payload, eventType: eventType});

  try {
    if (eventType === "check_run") {
      // TODO
      // await handleCheckRunEvent(payload);
    } else if (eventType === "push") {
      // TODO
      // await handlePushEvent(payload);
    } else if (eventType === "pull_request") {
      await handlePullRequestEvent(payload);
    }
  } catch (err) {
    error("Failed to handle GitHub webhook",
        {
          error: err.message,
          payload: payload,
          eventType: eventType,
        },
    );
    return res.status(500).send("Internal Server Error");
  }

  return res.status(200).send("OK");
}

/**
  * Handles a GitHub pull request event.
  *
  * This function is called when a pull
  * request is opened. It updates the release state if the pull request
  * was opened on a branch that is currently being tracked by one of the
  * releases.
  *
  * @param {Object} payload The payload from the GitHub webhook.
  * @return {Promise<void>}
  */
async function handlePullRequestEvent(payload) {
  if (payload.action === "opened") {
    const pullRequest = payload.pull_request;

    if (pullRequest && pullRequest.head) {
      const branchName = pullRequest.head.ref;
      log("Pull request event", {branchName: branchName});

      let releaseId;
      try {
        releaseId = await getReleaseIdFromBranch(branchName);
      } catch (err) {
        error("Error getting release ID from branch name",
            {error: err.message});
        return;
      }

      // If the releaseId exists, then a pull request was opened on a branch
      // that is being tracked for a release.
      //
      // We assume that once a pull request is created on a release branch,
      // the release configuration has been successfully generated.
      // If this assumption is wrong, then the release will enter an error
      // state.
      if (releaseId) {
        try {
          log("Pull request opened on a release branch",
              {
                releaseId: releaseId,
                branchName: branchName,
                pullRequest: pullRequest,
              });
          const octokit = new Octokit({auth: GITHUB_TOKEN.value()});
          await syncReleaseState(releaseId, octokit);
          log("Successfully synced release state", {releaseId: releaseId});
        } catch (err) {
          error("Failed to sync release state", {error: err.message});
        }
      } else {
        log("Pull request opened on a non-release branch",
            {branchName: branchName});
      }
    }
  }
}


module.exports = {
  githubWebhook,
  handlePullRequestEvent,
};
