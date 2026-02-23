import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jheison.chesscolate',
  appName: 'chessColate',
  webDir: '../../dist/apps/chessColate/browser',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
    },
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId:
        '798600509062-1hrnp7meoueqo1v0lipqdnrqpjln44nv.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
