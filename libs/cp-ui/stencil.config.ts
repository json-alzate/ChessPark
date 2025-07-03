import { Config } from '@stencil/core';

export const config: Config = {
  namespace: 'cp-ui',
  taskQueue: 'async',
  sourceMap: true,
  globalStyle: 'src/global/app.scss',
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
