import {initializeApp} from "firebase/app";
import {EmailAuthProvider, getAuth} from "firebase/auth";
import {getFirestore} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_API_KEY,
  AuthDomain: process.env.REACT_APP_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_PROJECT_ID,
  storageBucket: process.env.REACT_APP_STORAGE_BUCKET,
  messengerSenderId: process.env.REACT_APP_MESSENGER_SENDER_ID,
  appId: process.env.REACT_APP_APP_ID,
  measurementId: process.env.REACT_APP_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

// Initialize the Firebase Authentication service for the app instance
const auth = getAuth(app);

const db = getFirestore(app);

// Enable emulator connection for testing purposes.
// Connect to the Firebase Auth Emulator when running app locally.
// Uncomment the following line to enable auth emulator.
// connectAuthEmulator(auth, "http://localhost:9099");

/**
 * The `app` provides Firebase app-specific functionalities,
 * `auth` is the Firebase Authentication service instance for the app,
 * `EmailAuthProvider` is the Firebase Authentication Email/Password provider.
 */
export {app, auth, EmailAuthProvider, db};
