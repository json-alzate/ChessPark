/**
 * Helpers para enriquecer los eventos de analítica con metadatos legibles.
 * Mantiene la lógica de mapeo (tipo de plan → rutina, ruta → nombre de pantalla)
 * en un solo sitio para que todos los choke points emitan params consistentes.
 */

export type RoutineKind = 'default' | 'infinity' | 'reto333' | 'custom' | 'public';

export interface RoutineMeta {
  /** Familia de la rutina. */
  kind: RoutineKind;
  /** Minutos de la rutina (0 si no aplica). */
  minutes: number;
  /** Categoría estándar de ajedrez (vacío si no aplica). */
  category: 'bullet' | 'blitz' | 'rapid' | 'classical' | '';
  /** Nombre legible de la rutina. */
  name: string;
}

/** Minutos de rutina por defecto → categoría estándar (según training-plans.config). */
const MINUTES_TO_CATEGORY: Record<number, RoutineMeta['category']> = {
  1: 'bullet',
  3: 'blitz',
  5: 'blitz',
  10: 'rapid',
  20: 'rapid',
  30: 'classical',
};

/**
 * Deriva los metadatos de una rutina a partir de su `planType`.
 * Para planes por defecto (`plan{N}`) el número son los minutos.
 * Para custom/public el nombre real se sobreescribe en el choke point con el título.
 */
export function routineMetaFromPlanType(planType: string): RoutineMeta {
  switch (planType) {
    case 'infinity':
      return { kind: 'infinity', minutes: 0, category: '', name: 'Infinita' };
    case 'reto333':
      return { kind: 'reto333', minutes: 0, category: '', name: 'Reto 333' };
    case 'custom':
      return { kind: 'custom', minutes: 0, category: '', name: 'Personalizada' };
    case 'public':
      return { kind: 'public', minutes: 0, category: '', name: 'Pública' };
    default: {
      const minutes = parseInt(planType.replace('plan', ''), 10) || 0;
      return {
        kind: 'default',
        minutes,
        category: MINUTES_TO_CATEGORY[minutes] ?? '',
        name: minutes ? `Rutina ${minutes} min` : planType,
      };
    }
  }
}

/** Suma la duración de los bloques (segundos) y la devuelve en minutos redondeados. */
export function minutesFromBlocks(blocks?: { time?: number }[]): number {
  if (!blocks?.length) return 0;
  const seconds = blocks.reduce((sum, b) => sum + (b.time && b.time > 0 ? b.time : 0), 0);
  return Math.round(seconds / 60);
}

/** Nombre legible de cada pantalla (ruta → etiqueta) para `screen_view`. */
const SCREEN_NAMES: Record<string, string> = {
  '/home': 'Inicio',
  '/donation': 'Donación',
  '/puzzles/training': 'Entrenamiento',
  '/puzzles/plan-played': 'Rutina terminada',
  '/puzzles/plans-history': 'Historial de rutinas',
  '/puzzles/custom-plans': 'Rutinas personalizadas',
  '/puzzles/custom-plans/create': 'Crear rutina',
  '/puzzles/public-plans': 'Rutinas públicas',
  '/coordinates': 'Coordenadas',
  '/knight-tour': 'Recorrido del Caballo',
  '/chess960': 'Ajedrez 960',
  '/privacy': 'Privacidad',
  '/settings': 'Ajustes',
};

/**
 * Convierte una URL de ruta en un nombre de pantalla legible.
 * Ignora query/hash y resuelve las rutas dinámicas; si no la conoce,
 * devuelve la ruta cruda como fallback.
 */
export function screenNameFromUrl(url: string): string {
  const path = (url || '/').split('?')[0].split('#')[0];
  if (SCREEN_NAMES[path]) return SCREEN_NAMES[path];
  if (path.startsWith('/puzzles/custom-plans/edit')) return 'Editar rutina';
  if (path === '' || path === '/') return 'Inicio';
  return path;
}
