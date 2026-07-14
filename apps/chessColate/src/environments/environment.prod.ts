import { keys } from './private/keys';

export const environment = {
  production: true,
  environmentName: 'prod',
  firebase: keys.firebase,
  apiPuzzlesUrl: 'https://puzzles.chesscolate.com/puzzles/',
  version: '2.0.5',
  revenueCatApiKeyAndroid: keys.revenueCat.androidApiKey,
  revenueCatApiKeyIos: keys.revenueCat.iosApiKey,
  revenueCatApiKeyWeb: keys.revenueCat.webApiKey,
  // Observabilidad: activada en producción
  analyticsEnabled: true,
  crashlyticsEnabled: true
};
