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
      // Ambos iconos se resuelven contra res/drawable (no mipmap).
      // smallIcon: silueta monocroma para la barra de estado (Android la tiñe).
      smallIcon: 'ic_stat_reminder',
      // largeIcon: el icono real de la app a color, en el cuerpo de la
      // notificación. Es una copia de mipmap-xxxhdpi/ic_launcher.png en
      // res/drawable-nodpi/ (el plugin no lee de mipmap).
      largeIcon: 'ic_notification_large',
      iconColor: '#f28c18',
    },
  },
};

export default config;
