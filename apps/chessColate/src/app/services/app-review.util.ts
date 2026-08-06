/**
 * Lógica pura de la invitación a calificar la app (sin Angular ni plugins).
 *
 * Aquí vive todo lo testeable de la feature: los contadores de uso, el gate de
 * elegibilidad y la decisión de si este final de rutina es el momento correcto
 * para mostrar la tarjeta nativa de la tienda.
 * Ver docs/implementado/CALIFICAR_APP_FLOW.md.
 */

// Mismo formato de fecha local que usa el recordatorio de entrenamiento; se
// reutiliza para no tener dos maneras distintas de escribir "hoy" en el
// localStorage.
import { toLocalISODate } from './training-reminder.util';

export { toLocalISODate };

/** Estado local de la feature. Nunca sale del dispositivo. */
export interface AppReviewState {
  /** Rutinas terminadas desde que se instaló la app. */
  completedRoutines: number;
  /** Días distintos en los que se terminó al menos una rutina. */
  distinctDaysUsed: number;
  /** 'YYYY-MM-DD' local de la última rutina contada (para no contar el día dos veces). */
  lastRoutineDate: string | null;
  /** uid del último plan contado, para que volver a la pantalla no infle el contador. */
  lastCountedPlanUid: string | null;
  /** 'YYYY-MM-DD' local de la primera rutina registrada. */
  firstUseDate: string | null;
  /** 'YYYY-MM-DD' local de la última vez que se llamó a requestReview(). */
  lastReviewRequestDate: string | null;
  /** 'YYYY-MM-DD' local desde que cumple el gate de elegibilidad. */
  eligibleSince: string | null;
  /** Rutinas terminadas ya siendo elegible (la que le dio la elegibilidad cuenta como 1). */
  routinesSinceEligible: number;
}

export const DEFAULT_APP_REVIEW_STATE: AppReviewState = {
  completedRoutines: 0,
  distinctDaysUsed: 0,
  lastRoutineDate: null,
  lastCountedPlanUid: null,
  firstUseDate: null,
  lastReviewRequestDate: null,
  eligibleSince: null,
  routinesSinceEligible: 0,
};

/** Rutinas terminadas mínimas para considerar que hay opinión formada. */
export const MIN_COMPLETED_ROUTINES = 3;
/** Días distintos de uso mínimos: descarta a quien instaló hace un rato. */
export const MIN_DISTINCT_DAYS = 2;
/** Días de espera antes de volver a pedirla (por encima de la cuota del sistema). */
export const REVIEW_COOLDOWN_DAYS = 90;
/**
 * Rutinas que se dejan pasar esperando un pico emocional. Si el usuario ya es
 * elegible y pasan estas rutinas sin ningún "momento de victoria", se pide en
 * la siguiente (siempre que no haya ido mal).
 */
export const GRACE_WINDOW_ROUTINES = 2;
/** Aciertos (0–1) a partir de los cuales la rutina cuenta como buena. */
export const GOOD_ACCURACY = 0.7;
/** Aciertos por debajo de los cuales la rutina cuenta como mala. */
export const BAD_ACCURACY = 0.5;

/** Qué acabó disparando la petición (se reporta a analítica). */
export type AppReviewTrigger = 'new_record' | 'good_routine' | 'grace_window';

/** Cómo le fue al usuario en la rutina que acaba de terminar. */
export interface RoutineOutcome {
  /** Batió su máximo histórico de ELO en este tipo de rutina. */
  isNewRecord: boolean;
  /** Proporción de puzzles resueltos (0–1). */
  accuracy: number;
  /** Puntos de ELO ganados (+) o perdidos (−); null en planes antiguos. */
  eloDelta: number | null;
}

/** Días completos entre dos fechas 'YYYY-MM-DD' locales. */
export function daysBetween(fromISODate: string, toISODate: string): number {
  const [fromYear, fromMonth, fromDay] = fromISODate.split('-').map(Number);
  const [toYear, toMonth, toDay] = toISODate.split('-').map(Number);
  const from = Date.UTC(fromYear, fromMonth - 1, fromDay);
  const to = Date.UTC(toYear, toMonth - 1, toDay);
  return Math.floor((to - from) / 86400000);
}

/**
 * Actualiza los contadores tras terminar una rutina. Devuelve el estado sin
 * tocar el original; el mismo plan no se cuenta dos veces (volver a la
 * pantalla de resultados no debe inflar nada).
 */
export function registerRoutine(
  state: AppReviewState,
  planUid: string,
  now: Date
): AppReviewState {
  if (state.lastCountedPlanUid === planUid) {
    return state;
  }

  const today = toLocalISODate(now);
  const isNewDay = state.lastRoutineDate !== today;

  const next: AppReviewState = {
    ...state,
    completedRoutines: state.completedRoutines + 1,
    distinctDaysUsed: state.distinctDaysUsed + (isNewDay ? 1 : 0),
    lastRoutineDate: today,
    lastCountedPlanUid: planUid,
    firstUseDate: state.firstUseDate ?? today,
  };

  // La ventana de gracia solo empieza a correr cuando ya se cumple el gate.
  if (next.eligibleSince !== null) {
    next.routinesSinceEligible = state.routinesSinceEligible + 1;
  } else if (meetsUsageGate(next)) {
    next.eligibleSince = today;
    next.routinesSinceEligible = 1;
  }

  return next;
}

/** Uso suficiente como para tener opinión formada (sin mirar el cooldown). */
function meetsUsageGate(state: AppReviewState): boolean {
  return (
    state.completedRoutines >= MIN_COMPLETED_ROUTINES &&
    state.distinctDaysUsed >= MIN_DISTINCT_DAYS
  );
}

/** ¿Se le puede pedir la reseña a este usuario hoy? (uso suficiente + sin cooldown activo) */
export function isEligible(state: AppReviewState, now: Date): boolean {
  if (!meetsUsageGate(state)) {
    return false;
  }
  if (state.lastReviewRequestDate === null) {
    return true;
  }
  return (
    daysBetween(state.lastReviewRequestDate, toLocalISODate(now)) >=
    REVIEW_COOLDOWN_DAYS
  );
}

/** La rutina fue claramente mal: nunca se pide la reseña justo después. */
export function isBadRoutine(outcome: RoutineOutcome): boolean {
  return (
    outcome.accuracy < BAD_ACCURACY ||
    (outcome.eloDelta !== null && outcome.eloDelta < 0)
  );
}

/** Pico emocional: récord personal, o una rutina que salió bien. */
function isWinningMoment(outcome: RoutineOutcome): boolean {
  return (
    outcome.isNewRecord ||
    outcome.accuracy >= GOOD_ACCURACY ||
    (outcome.eloDelta !== null && outcome.eloDelta > 0)
  );
}

/** Ya se dejaron pasar suficientes rutinas esperando un pico que no llegó. */
function graceWindowExpired(state: AppReviewState): boolean {
  return state.routinesSinceEligible > GRACE_WINDOW_ROUTINES;
}

/**
 * Decide si este final de rutina es el momento de pedir la reseña y con qué
 * motivo. `null` = todavía no. Espera el estado **ya actualizado** con la
 * rutina recién terminada (`registerRoutine`).
 */
export function resolveTrigger(
  state: AppReviewState,
  outcome: RoutineOutcome,
  now: Date
): AppReviewTrigger | null {
  if (!isEligible(state, now)) {
    return null;
  }
  if (outcome.isNewRecord) {
    return 'new_record';
  }
  if (isBadRoutine(outcome)) {
    // Ni siquiera por ventana de gracia: pedir reseña tras un mal rato es la
    // mejor forma de ganarse una estrella.
    return null;
  }
  if (isWinningMoment(outcome)) {
    return 'good_routine';
  }
  return graceWindowExpired(state) ? 'grace_window' : null;
}

/** Marca que se pidió hoy: arranca el cooldown y reinicia la ventana de gracia. */
export function markRequested(
  state: AppReviewState,
  now: Date
): AppReviewState {
  return {
    ...state,
    lastReviewRequestDate: toLocalISODate(now),
    eligibleSince: null,
    routinesSinceEligible: 0,
  };
}

/** Proporción de puzzles resueltos (0–1) de una rutina. 0 si no se jugó ninguno. */
export function routineAccuracy(
  blocks: ReadonlyArray<{ puzzlesPlayed: ReadonlyArray<{ resolved: boolean }> }>
): number {
  const played = blocks.flatMap((block) => block.puzzlesPlayed);
  if (played.length === 0) {
    return 0;
  }
  return played.filter((puzzle) => puzzle.resolved).length / played.length;
}
