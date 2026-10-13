import { eloToStartForDuration, totalBlockSeconds } from '@features/training/utils/custom-plan-elo.util';

const ELOS = { plan5Total: 1111, plan10Total: 2222, plan20Total: 3333, plan30Total: 4444 } as never;

describe('eloToStartForDuration', () => {
  it.each([
    [0, 1111],
    [60, 1111],
    [300, 1111],
    [301, 2222],
    [600, 2222],
    [601, 3333],
    [1200, 3333],
    [1201, 4444],
    [5000, 4444],
  ])('una rutina de %i s arranca con %i', (seconds, expected) => {
    expect(eloToStartForDuration(seconds, ELOS)).toBe(expected);
  });

  it('sin elos en el perfil arranca en 1500', () => {
    expect(eloToStartForDuration(300, undefined)).toBe(1500);
  });

  it('si el perfil no tiene el elo del tramo arranca en 1500', () => {
    expect(eloToStartForDuration(900, { plan5Total: 1111 } as never)).toBe(1500);
  });
});

describe('totalBlockSeconds', () => {
  it('suma solo los bloques con tiempo', () => {
    expect(totalBlockSeconds([{ time: 60 }, { time: -1 }, { time: 0 }, { time: 240 }])).toBe(300);
  });
});
