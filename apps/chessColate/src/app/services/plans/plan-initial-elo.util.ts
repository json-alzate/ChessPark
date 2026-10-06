import { PlanTypes, User } from '@cpark/models';

/**
 * Elo de referencia de una rutina al empezar a jugarla: el total con el que
 * arranca y el máximo histórico contra el que se compara la sesión.
 */
export interface InitialPlanElo {
  /** Elo total con el que empieza la rutina. */
  initialTotalElo: number;
  /** Máximo histórico de referencia. Nunca es menor que el total de arranque. */
  initialMaxElo: number;
}

/** Elo que se asume cuando no hay ninguno guardado. */
export const DEFAULT_PLAN_ELO = 1500;

/**
 * Elo inicial de una rutina predefinida (warmup, plan1, plan3…).
 *
 * El total de arranque lo resuelve quien llama (en la app, ProfileService) para
 * que la regla de "sin datos" viva en un único sitio. Aquí solo se decide si el
 * máximo histórico guardado en el perfil existe; si no, se usa el total.
 *
 * @param planType Tipo de rutina; define la clave `${planType}MaxTotal` del perfil.
 * @param elos Elos del perfil del usuario, o `undefined` si no hay perfil con elos.
 * @param initialTotal Elo total de arranque ya resuelto para esa rutina.
 * @returns Par de elos iniciales listo para guardar en el plan.
 */
export function initialEloForDefaultPlan(
  planType: PlanTypes,
  elos: User['elos'] | undefined,
  initialTotal: number
): InitialPlanElo {
  const maxTotalKey = `${planType}MaxTotal` as keyof NonNullable<User['elos']>;
  const storedMax = elos?.[maxTotalKey];
  const initialMax = typeof storedMax === 'number' ? storedMax : initialTotal;

  return { initialTotalElo: initialTotal, initialMaxElo: initialMax };
}

/**
 * Elo inicial de una rutina personalizada, a partir de sus elos propios en
 * Firestore. Si el documento aún no tiene total, se parte de 1500; si no tiene
 * máximo, el máximo es el total.
 *
 * @param planElos Elos guardados de la rutina, o `null`/`undefined` si no existen.
 * @returns Par de elos iniciales listo para guardar en el plan.
 */
export function initialEloForCustomPlan(
  planElos: { total?: number; maxTotal?: number } | null | undefined
): InitialPlanElo {
  const initialTotal = planElos?.total ?? DEFAULT_PLAN_ELO;
  const initialMax = planElos?.maxTotal ?? initialTotal;

  return { initialTotalElo: initialTotal, initialMaxElo: initialMax };
}
