import { Config } from '@stencil/core';
import { sass } from '@stencil/sass';

export const config: Config = {
  namespace: 'cp-ui',
  taskQueue: 'async',
  sourceMap: true,
  globalStyle: 'src/global/app.scss',
  plugins: [
    sass(),
  ],
  outputTargets: [
    {
      type: 'dist',
      esmLoaderPath: '../loader',
    },
    {
      type: 'dist-custom-elements',
    },
    {
      type: 'docs-readme',
    },
    {
      type: 'www',
      serviceWorker: null,
    },
  ],
  extras: {
    experimentalImportInjection: true,
  },
};
