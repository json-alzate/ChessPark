import { StreakConfig, StreakRun } from '@cpark/models';

import {
  applyRunToRecord,
  DEFAULT_STREAK_CONFIG,
  emptyStreakRecord,
  isNewRecord,
  nextTargetElo,
  pickTheme,
} from './streak.util';

/** Racha terminada de ejemplo, con lo mínimo para actualizar el récord. */
function runWith(overrides: Partial<StreakRun> = {}): StreakRun {
  return {
    uid: 'run-1',
    startedAt: 1_000,
    finishedAt: 2_000,
    config: DEFAULT_STREAK_CONFIG,
    score: 5,
    skipsUsed: 0,
    endedBy: 'fail',
    puzzleUids: [],
    maxEloReached: 900,
    ...overrides,
  };
}

describe('nextTargetElo', () => {
  const config: StreakConfig = {
    eloBase: 800,
    step: 15,
    eloCap: 2800,
    theme: 'all',
    maxSkips: 1,
  };

  it('sube un paso sobre el elo real del puzzle resuelto, no sobre el objetivo', () => {
    // Se pidió un puzzle de 1000 y el catálogo sirvió uno de 1012
    expect(nextTargetElo(1012, 1000, config)).toBe(1027);
  });

  it('el objetivo anterior hace de suelo: la dificultad nunca retrocede', () => {
    // El puzzle salió flojo dentro de su franja; el siguiente no baja de 1000
    expect(nextTargetElo(980, 1000, config)).toBe(1000);
  });

  it('el suelo no impide avanzar cuando el puzzle sí da para subir', () => {
    expect(nextTargetElo(996, 1000, config)).toBe(1011);
  });

  it('no pasa del techo del catálogo por larga que sea la racha', () => {
    expect(nextTargetElo(2795, 2790, config)).toBe(2800);
    expect(nextTargetElo(2800, 2800, config)).toBe(2800);
  });

  it('redondea elos con decimales para no arrastrar fracciones', () => {
    expect(nextTargetElo(1000.6, 900, config)).toBe(1016);
  });
});

describe('pickTheme', () => {
  it('con un tema fijo lo respeta aunque haya candidatos', () => {
    const config = { ...DEFAULT_STREAK_CONFIG, theme: 'fork' };
    expect(pickTheme(config, ['pin', 'skewer'], () => 0)).toBe('fork');
  });

  it('con la mezcla elige uno de los candidatos', () => {
    const candidates = ['fork', 'pin', 'skewer'];
    expect(pickTheme(DEFAULT_STREAK_CONFIG, candidates, () => 0)).toBe('fork');
    expect(pickTheme(DEFAULT_STREAK_CONFIG, candidates, () => 0.99)).toBe(
      'skewer'
    );
  });

  it('sin candidatos no inventa un tema', () => {
    expect(pickTheme(DEFAULT_STREAK_CONFIG, [], () => 0)).toBeUndefined();
  });
});

describe('isNewRecord', () => {
  it('sin récord previo cualquier racha con puntos es récord', () => {
    expect(isNewRecord(1, null)).toBe(true);
    expect(isNewRecord(0, null)).toBe(false);
  });

  it('igualar el récord no cuenta como superarlo', () => {
    const record = { ...emptyStreakRecord(), bestScore: 7 };
    expect(isNewRecord(7, record)).toBe(false);
    expect(isNewRecord(8, record)).toBe(true);
  });
});

describe('applyRunToRecord', () => {
  it('la primera racha estrena el récord', () => {
    const record = applyRunToRecord(null, runWith({ score: 5 }));

    expect(record.bestScore).toBe(5);
    expect(record.bestRunUid).toBe('run-1');
    expect(record.achievedAt).toBe(2_000);
    expect(record.runsPlayed).toBe(1);
    expect(record.lastScore).toBe(5);
  });

  it('una racha peor no toca el récord pero sí el historial', () => {
    const previous = applyRunToRecord(null, runWith({ score: 9 }));
    const record = applyRunToRecord(
      previous,
      runWith({ uid: 'run-2', score: 3, finishedAt: 5_000 })
    );

    expect(record.bestScore).toBe(9);
    expect(record.bestRunUid).toBe('run-1');
    expect(record.achievedAt).toBe(2_000);
    expect(record.runsPlayed).toBe(2);
    expect(record.lastScore).toBe(3);
    expect(record.lastPlayedAt).toBe(5_000);
  });

  it('abandonar cuenta igual que fallar: la racha lograda se registra', () => {
    const previous = applyRunToRecord(null, runWith({ score: 4 }));
    const record = applyRunToRecord(
      previous,
      runWith({ uid: 'run-2', score: 11, endedBy: 'quit', finishedAt: 7_000 })
    );

    expect(record.bestScore).toBe(11);
    expect(record.bestRunUid).toBe('run-2');
    expect(record.achievedAt).toBe(7_000);
  });

  it('sin hora de fin usa la de inicio', () => {
    const record = applyRunToRecord(
      null,
      runWith({ finishedAt: undefined, startedAt: 42 })
    );

    expect(record.achievedAt).toBe(42);
    expect(record.lastPlayedAt).toBe(42);
  });
});
