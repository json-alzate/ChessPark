import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'chessColate',
  webDir: '../../dist/apps/chess-colate-elements/browser',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    // Configuración para plugins específicos si los necesitas
  },
};

export default config;
