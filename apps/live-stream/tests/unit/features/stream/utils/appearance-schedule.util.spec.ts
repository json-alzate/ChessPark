import { APPEARANCE_POOLS, appearanceAt, dayPhaseAt, DayPhase } from '@features/stream/utils/appearance-schedule.util';

const DAY = 100_000;
const at = (progress: number): number => progress * DAY;

describe('dayPhaseAt', () => {
  it('recorre amanecer, día, atardecer y noche en orden', () => {
    expect(dayPhaseAt(at(0.0), DAY)).toBe('dawn');
    expect(dayPhaseAt(at(0.2), DAY)).toBe('day');
    expect(dayPhaseAt(at(0.48), DAY)).toBe('dusk');
    expect(dayPhaseAt(at(0.7), DAY)).toBe('night');
    expect(dayPhaseAt(at(0.95), DAY)).toBe('dawn');
  });

  it('se repite cada día', () => {
    expect(dayPhaseAt(at(0.7) + DAY * 3, DAY)).toBe('night');
  });
});

describe('appearanceAt', () => {
  const ROTATION = 1_000;

  it('rota dentro de la fase cada cierto tiempo', () => {
    const first = appearanceAt(at(0.2), DAY, ROTATION);
    const later = appearanceAt(at(0.2) + ROTATION, DAY, ROTATION);

    expect(later).not.toEqual(first);
  });

  it('da la misma combinación mientras no toque rotar', () => {
    expect(appearanceAt(at(0.2) + 10, DAY, ROTATION)).toEqual(appearanceAt(at(0.2) + 20, DAY, ROTATION));
  });

  it('depende solo de la hora: un reinicio retoma la misma combinación', () => {
    expect(appearanceAt(7_654_321, DAY, ROTATION)).toEqual(appearanceAt(7_654_321, DAY, ROTATION));
  });

  it('de noche solo usa tableros oscuros, no los más brillantes', () => {
    const BRIGHT = ['black-and-white', 'green-classic', 'sage', 'blue'];
    APPEARANCE_POOLS.night.forEach((a) => expect(BRIGHT).not.toContain(a.board));
  });
});

// Que cada set de piezas y cada tablero existan lo garantiza el compilador: están tipados como
// `PiecesStyle` y `BoardStyle` de la lib.
describe('APPEARANCE_POOLS', () => {
  const all = (Object.keys(APPEARANCE_POOLS) as DayPhase[]).flatMap((phase) => APPEARANCE_POOLS[phase]);

  // GPL, MIT, Apache y CC0: sin atribución obligatoria en la descripción del directo. Los sets CC BY
  // (kiwen-suwi, firi, totoy, papercut) quedan fuera a propósito.
  it('solo usa sets de piezas de licencia libre sin atribución obligatoria', () => {
    const PERMITIDAS = ['cburnett', 'celtic', 'chessnut', 'rhosgfx'];
    all.forEach((a) => expect(PERMITIDAS).toContain(a.pieces));
  });

  it('cada fase tiene al menos dos combinaciones para poder rotar', () => {
    (Object.keys(APPEARANCE_POOLS) as DayPhase[]).forEach((phase) =>
      expect(APPEARANCE_POOLS[phase].length).toBeGreaterThanOrEqual(2)
    );
  });
});
