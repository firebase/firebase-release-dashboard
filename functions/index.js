// The Cloud Functions for the Firebase SDK to create Cloud Functions and 
// triggers.
const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const {onDocumentCreated} = require("firebase-functions/v2/firestore");

// The Firebase Admin SDK to access Firestore.
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");

initializeApp();

// Take the text parameter that is sent to this HTTP endpoint and
// store it in Firestore at the /messages/:documentID/original path.
exports.addmessage = onRequest(async (req, res) => {
    // Grab the text parameter
    const original = req.query.text;

    // Push the new message into Firestore
    const writeResult = await getFirestore()
        .collection("messages")
        .add({original: original});

    // Respond that we've successfully written the message
    res.json({result: `Message with ID: ${writeResult.id} added.`});
});
