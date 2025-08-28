// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

// for deploy comment out the next line
// export const environment = {
//   production: false,
//   environmentName: 'dev',
//   firebase: {
//     projectId: process?.env?.FIREBASE_projectId,
//     appId: process?.env?.FIREBASE_appId,
//     storageBucket: process?.env?.FIREBASE_storageBucket,
//     locationId: process?.env?.FIREBASE_locationId,
//     apiKey: process?.env?.FIREBASE_apiKey,
//     authDomain: process?.env?.FIREBASE_authDomain,
//     messagingSenderId: process?.env?.FIREBASE_messagingSenderId,
//     measurementId: process?.env?.FIREBASE_measurementId,
//   },
//   apiPuzzlesUrl: 'http://[::1]:3000/puzzles/',
//   version: '1.0.1'
// };

import { keys } from './private/keys';

export const environment = {
  production: false,
  environmentName: 'dev',
  firebase: keys.firebase,
  apiPuzzlesUrl: 'http://[::1]:3000/puzzles/',
  // apiPuzzlesUrl: 'https://puzzles.chesscolate.com/puzzles/',
  version: '1.4.0'
};




/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/dist/zone-error';  // Included with Angular CLI.
