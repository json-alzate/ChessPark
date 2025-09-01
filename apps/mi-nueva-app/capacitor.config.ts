import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'mi-nueva-app',
  webDir: '../../dist/apps/mi-nueva-app-elements/browser',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    // Configuración para plugins específicos si los necesitas
  },
};

export default config;
