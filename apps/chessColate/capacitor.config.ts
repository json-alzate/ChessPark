import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jheison.chesscolate',
  appName: 'chessColate',
  webDir: '../../dist/apps/chessColate/browser',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: false,
      backgroundColor: '#000000',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
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
    LocalNotifications: {
      // Debe existir en res/drawable (no mipmap): el plugin resuelve el nombre
      // contra "drawable" y si no lo encuentra cae al icono genérico del SO.
      smallIcon: 'ic_stat_reminder',
      iconColor: '#f28c18',
    },
  },
};

export default config;
