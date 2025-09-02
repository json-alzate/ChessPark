import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'chess-podcasts',
  webDir: '../../dist/apps/chess-podcasts-elements/browser',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    // Configuración para plugins específicos si los necesitas
  },
};

export default config;
