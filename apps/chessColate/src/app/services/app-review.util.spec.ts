import {
  AppReviewState,
  DEFAULT_APP_REVIEW_STATE,
  RoutineOutcome,
  daysBetween,
  isBadRoutine,
  isEligible,
  markRequested,
  registerRoutine,
  resolveTrigger,
  routineAccuracy,
} from './app-review.util';

/** Estado de ejemplo, con lo mínimo para razonar sobre el gate. */
function stateWith(overrides: Partial<AppReviewState> = {}): AppReviewState {
  return { ...DEFAULT_APP_REVIEW_STATE, ...overrides };
}

/** Rutina que salió bien y sin récord (el caso más común). */
function outcomeWith(overrides: Partial<RoutineOutcome> = {}): RoutineOutcome {
  return { isNewRecord: false, accuracy: 0.8, eloDelta: 5, ...overrides };
}

/** Fecha local a mediodía, para que el huso no mueva el día. */
function at(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

describe('daysBetween', () => {
  it('cuenta días completos entre dos fechas locales', () => {
    expect(daysBetween('2026-01-01', '2026-04-01')).toBe(90);
    expect(daysBetween('2026-01-01', '2026-01-01')).toBe(0);
  });
});

describe('registerRoutine', () => {
  it('suma la rutina y estrena el día y la fecha de primer uso', () => {
    const state = registerRoutine(stateWith(), 'plan-1', at('2026-03-01'));

    expect(state.completedRoutines).toBe(1);
    expect(state.distinctDaysUsed).toBe(1);
    expect(state.firstUseDate).toBe('2026-03-01');
  });

  it('no cuenta dos veces el mismo plan', () => {
    const first = registerRoutine(stateWith(), 'plan-1', at('2026-03-01'));
    const second = registerRoutine(first, 'plan-1', at('2026-03-01'));

    expect(second).toBe(first);
  });

  it('varias rutinas el mismo día suman una sola jornada', () => {
    let state = registerRoutine(stateWith(), 'plan-1', at('2026-03-01'));
    state = registerRoutine(state, 'plan-2', at('2026-03-01'));

    expect(state.completedRoutines).toBe(2);
    expect(state.distinctDaysUsed).toBe(1);
  });

  it('marca la elegibilidad en la rutina que completa el gate', () => {
    let state = registerRoutine(stateWith(), 'plan-1', at('2026-03-01'));
    state = registerRoutine(state, 'plan-2', at('2026-03-02'));
    expect(state.eligibleSince).toBeNull();

    state = registerRoutine(state, 'plan-3', at('2026-03-02'));

    expect(state.eligibleSince).toBe('2026-03-02');
    expect(state.routinesSinceEligible).toBe(1);
  });
});

describe('isEligible', () => {
  const eligible = stateWith({ completedRoutines: 3, distinctDaysUsed: 2 });

  it('exige 3 rutinas y 2 días distintos', () => {
    expect(isEligible(eligible, at('2026-03-02'))).toBe(true);
    expect(
      isEligible({ ...eligible, completedRoutines: 2 }, at('2026-03-02'))
    ).toBe(false);
    expect(
      isEligible({ ...eligible, distinctDaysUsed: 1 }, at('2026-03-02'))
    ).toBe(false);
  });

  it('bloquea durante los 90 días siguientes a la última petición', () => {
    const asked = { ...eligible, lastReviewRequestDate: '2026-01-01' };

    expect(isEligible(asked, at('2026-03-31'))).toBe(false);
    expect(isEligible(asked, at('2026-04-01'))).toBe(true);
  });
});

describe('resolveTrigger', () => {
  const now = at('2026-03-02');
  const eligible = stateWith({
    completedRoutines: 3,
    distinctDaysUsed: 2,
    eligibleSince: '2026-03-02',
    routinesSinceEligible: 1,
  });

  it('no dispara si el usuario aún no es elegible', () => {
    expect(resolveTrigger(stateWith(), outcomeWith(), now)).toBeNull();
  });

  it('el récord personal manda por encima de todo', () => {
    expect(
      resolveTrigger(eligible, outcomeWith({ isNewRecord: true }), now)
    ).toBe('new_record');
  });

  it('una rutina que salió bien también sirve', () => {
    expect(resolveTrigger(eligible, outcomeWith({ accuracy: 0.75 }), now)).toBe(
      'good_routine'
    );
  });

  it('nunca dispara justo después de una mala rutina', () => {
    const bad = outcomeWith({ accuracy: 0.3, eloDelta: -12 });

    expect(resolveTrigger(eligible, bad, now)).toBeNull();
    expect(
      resolveTrigger({ ...eligible, routinesSinceEligible: 9 }, bad, now)
    ).toBeNull();
  });

  it('espera un pico durante 2 rutinas y en la siguiente pide igual', () => {
    const tepid = outcomeWith({ accuracy: 0.6, eloDelta: 0 });

    expect(
      resolveTrigger({ ...eligible, routinesSinceEligible: 2 }, tepid, now)
    ).toBeNull();
    expect(
      resolveTrigger({ ...eligible, routinesSinceEligible: 3 }, tepid, now)
    ).toBe('grace_window');
  });
});

describe('markRequested', () => {
  it('arranca la espera y reinicia la ventana de gracia', () => {
    const state = markRequested(
      stateWith({ routinesSinceEligible: 4, eligibleSince: '2026-03-02' }),
      at('2026-03-05')
    );

    expect(state.lastReviewRequestDate).toBe('2026-03-05');
    expect(state.routinesSinceEligible).toBe(0);
    expect(state.eligibleSince).toBeNull();
  });
});

describe('isBadRoutine', () => {
  it('es mala si falló más de la mitad o si bajó el ELO', () => {
    expect(isBadRoutine(outcomeWith({ accuracy: 0.4 }))).toBe(true);
    expect(isBadRoutine(outcomeWith({ eloDelta: -1 }))).toBe(true);
    expect(isBadRoutine(outcomeWith({ accuracy: 0.6, eloDelta: 0 }))).toBe(
      false
    );
  });
});

describe('routineAccuracy', () => {
  it('cuenta los resueltos sobre el total de todos los bloques', () => {
    const blocks = [
      { puzzlesPlayed: [{ resolved: true }, { resolved: false }] },
      { puzzlesPlayed: [{ resolved: true }, { resolved: true }] },
    ];

    expect(routineAccuracy(blocks)).toBe(0.75);
  });

  it('sin puzzles jugados no hay aciertos', () => {
    expect(routineAccuracy([{ puzzlesPlayed: [] }])).toBe(0);
  });
});
