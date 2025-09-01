import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: '<%= name %>',
  webDir: '../../dist/apps/<%= name %>-elements/browser',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    // Configuración para plugins específicos si los necesitas
  }
};

export default config;
