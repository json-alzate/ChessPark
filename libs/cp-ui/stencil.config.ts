import { Config } from '@stencil/core';

export const config: Config = {
  namespace: 'cp-ui',
  taskQueue: 'async',
  sourceMap: true,

  extras: {
    experimentalImportInjection: true,
  },
};
