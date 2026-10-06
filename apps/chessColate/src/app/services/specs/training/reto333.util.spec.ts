import { UserPuzzle } from '@cpark/models';

import {
  formatMinutesSeconds,
  RETO333_TARGET,
  summarizeReto333,
} from '../../training/reto333.util';

function attempt(resolved: boolean): UserPuzzle {
  return {
    uid: 'x',
    uidUser: '',
    uidPuzzle: 'p',
    date: 0,
    resolved,
    failByTime: false,
    resolvedTime: 0,
    currentEloUser: 0,
    eloPuzzle: 1500,
    themes: [],
  };
}

describe('summarizeReto333', () => {
  it('sin intentos ni inicio devuelve cero y no está completado', () => {
    expect(summarizeReto333([], null, 1_000_000)).toEqual({
      score: 0,
      timeSeconds: 0,
      timeString: '0m 0s',
      completed: false,
    });
  });

  it('cuenta solo los puzzles resueltos', () => {
    const played = [attempt(true), attempt(false), attempt(true)];

    expect(summarizeReto333(played, null, 0).score).toBe(2);
  });

  it('calcula el tiempo desde el inicio real y lo formatea', () => {
    const start = 1_000_000;
    const now = start + 125_900; // 125,9 s → 125 s → 2m 5s

    const summary = summarizeReto333([], start, now);

    expect(summary.timeSeconds).toBe(125);
    expect(summary.timeString).toBe('2m 5s');
  });

  it('marca completado al llegar a 333 resueltos y no antes', () => {
    const justBelow = Array.from({ length: RETO333_TARGET - 1 }, () =>
      attempt(true)
    );
    const exact = [...justBelow, attempt(true)];

    expect(summarizeReto333(justBelow, null, 0).completed).toBe(false);
    expect(summarizeReto333(exact, null, 0).completed).toBe(true);
  });
});

describe('formatMinutesSeconds', () => {
  it.each([
    [0, '0m 0s'],
    [59, '0m 59s'],
    [60, '1m 0s'],
    [3725, '62m 5s'],
  ])('formatea %i segundos como "%s"', (seconds, expected) => {
    expect(formatMinutesSeconds(seconds)).toBe(expected);
  });
});
