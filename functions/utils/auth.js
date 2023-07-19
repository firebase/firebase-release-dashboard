const admin = require("firebase-admin");

const {
  warn,
} = require("firebase-functions/logger");

/**
  * Validates header of the request to ensure that the request is coming from
  * an authenticated user in Firebase Auth.
  *
  * @param {Object} req - The request from the client.
  * @param {Object} res - The response object to be sent to the client.
  * @param {Function} next - The next function to be called.
  */
async function authenticateUser(req, res, next) {
  if (!req.headers.authorization ||
    !req.headers.authorization.startsWith("Bearer ")) {
    warn("Request missing Firebase ID token, rejecting request.");
    res.status(403).send("Unauthorized");
    return;
  }
  const idToken = req.headers.authorization.split("Bearer ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (err) {
    warn("Error while verifying Firebase ID token:", {error: err.message});
    res.status(403).send("Unauthorized");
  }
}

module.exports = {authenticateUser};
