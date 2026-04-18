import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'chess-bot-studio',
  webDir: '../../dist/apps/chess-bot-studio-elements/browser',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    // Configuración para plugins específicos si los necesitas
  },
};

export default config;
