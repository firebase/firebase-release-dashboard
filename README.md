# Firebase Release Dashboard

A release dashboard to help [Firebase Android SDK](https://github.com/firebase/firebase-android-sdk) developers track the state of releases.

This is a web application built with React, and supported by Firebase.

The web page can be accessed at https://acore-release-dashboard.web.app

## Development Environment

Anyone can run this application locally in the emulators, but only administrators can deploy.

### Set up

 - Install [Node](https://nodejs.org/en)
 - Install and configure the [Firebase CLI](https://firebase.google.com/docs/cli)

### Cloud Functions

In the `functions` directory, you can install dependencies with `npm install`.

You can run the unit tests with `npm test`.

### React app

In the `firebase-android-release-dashboard` directory, you can:

1. Install dependencies by running `npm install`
2. **Admins only**: (Only needed if deploying) Set up environment variables in `.env`. The environment variables that need to be defined are used for initializing the Firebase configuration in [firebase.js](https://github.com/firebase/firebase-release-dashboard/tree/master/firebase-android-release-dashboard/src/firebase.js). The values that need to be assigned to the environment variables can be found in [Project Settings](https://firebase.corp.google.com/project/acore-release-dashboard/settings/general/web:N2U1YmE2YTgtNWFjMC00YTUzLWIzNTctN2RkNWE2N2RhNDQ4) in the Firebase console of the project.
3. Generate a production build with `npm run build`

During local development, you can start the development server by running `npm start`, or serve the production build by running `serve -s build/`.

### Deploy

**Important: Deploying the project updates everything. Please make sure your local version of the application is safe to deploy. This can include making sure the `firestore.rules` have not been modified, the environment variables are set, and that the production build you're serving has been approved and is working.**

To deploy the application to production, from the root directory, you can run `firebase deploy`.

### Emulators

To use the emulators, you can run:

```bash
firebase emulators:start
```

## Contributing

Please read our [Contribution Guidelines](https://github.com/firebase/firebase-release-dashboard/blob/master/docs/contributing.md) to get started.
