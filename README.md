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

### React app

In the `firebase-android-release-dashboard` directory, you can:

1. Install dependencies by running `npm install`
2. (Only needed if deploying) Set up environment variables in `.env`
3. Generate a production build with `npm run build`

### Deploy

To deploy the application to production, from the root directory, you can run `firebase deploy`.

### Emulators

To use the emulators, you can run:

```bash
firebase emulators:start
```

## Contributing

Please read our [Contribution Guidelines](https://github.com/firebase/firebase-release-dashboard/blob/master/docs/contributing.md) to get started.
