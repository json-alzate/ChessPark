import { keys } from './private/keys';

export const environment = {
  production: true,
  environmentName: 'prod',
  firebase: keys.firebase,
  apiPuzzlesUrl: 'https://puzzles.chesscolate.com/puzzles/',
  version: '2.0.0'
};
