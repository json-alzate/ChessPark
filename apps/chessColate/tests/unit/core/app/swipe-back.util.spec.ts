import { isSwipeBackAllowed } from '@core/app/swipe-back.util';

describe('isSwipeBackAllowed', () => {
  it.each([
    '/puzzles/training',
    '/streak',
    '/woodpecker/play',
    '/coordinates',
    '/knight-tour',
    '/chess960',
    '/games/viewer?index=3',
    '/streak?x=1#a',
  ])('en %s el tablero llega al borde: no se permite deslizar para volver', (url) => {
    expect(isSwipeBackAllowed(url)).toBe(false);
  });

  it.each([
    '/home',
    '/settings',
    '/games',
    '/games/alekhine',
    '/puzzles/plan-played',
    '/puzzles/custom-plans',
    '/analytics',
    '/woodpecker',
    '/streaks-info',
  ])('en %s sí se permite', (url) => {
    expect(isSwipeBackAllowed(url)).toBe(true);
  });
});
