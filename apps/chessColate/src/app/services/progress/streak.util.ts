/**
 * Lógica pura del modo Racha: rampa de dificultad, elección de tema y
 * actualización del récord. Sin dependencias de Angular ni de almacenamiento,
 * para poder testearla directamente.
 */

import { StreakConfig, StreakRecord, StreakRun } from '@cpark/models';

/**
 * Configuración por defecto: arranca fácil, sube poco a poco y mezcla temas.
 *
 * El techo es el límite real del catálogo, no un límite de juego: con un paso
 * de 15 harían falta unos 130 aciertos seguidos para acercarse, así que en la
 * práctica solo existe para no pedir nunca puzzles que no existen.
 */
export const DEFAULT_STREAK_CONFIG: StreakConfig = {
  eloBase: 800,
  step: 15,
  eloCap: 2800,
  theme: 'all',
  maxSkips: 1,
};

/**
 * Temas del catálogo que no describen un motivo táctico sino la duración o el
 * desenlace del puzzle. Se excluyen de la mezcla porque como "tema" no aportan
 * variedad reconocible.
 */
export const STREAK_EXCLUDED_THEMES = [
  'oneMove',
  'short',
  'long',
  'veryLong',
  'equality',
  'advantage',
  'crushing',
];

/**
 * Elo objetivo del siguiente puzzle de la racha.
 *
 * La rampa se encadena sobre el **elo real** del puzzle que se acaba de
 * resolver, no sobre una fórmula: así el número que ve el usuario es el de
 * verdad y la progresión se autocorrige si el catálogo sirve algo desviado.
 *
 * El objetivo anterior hace de suelo, de modo que la dificultad nunca puede
 * retroceder ni estancarse por un puzzle que salió flojo dentro de su franja.
 */
export function nextTargetElo(
  solvedPuzzleElo: number,
  previousTarget: number,
  config: StreakConfig
): number {
  const advanced = Math.round(solvedPuzzleElo) + config.step;
  return Math.min(config.eloCap, Math.max(previousTarget, advanced));
}

/**
 * Elige el tema del siguiente puzzle.
 *
 * Con `theme: 'all'` se toma uno al azar de los candidatos (los que de verdad
 * tienen puzzles a ese elo); con un tema fijo se respeta siempre.
 * Devuelve `undefined` si no hay candidatos: el llamador decide el respaldo.
 */
export function pickTheme(
  config: StreakConfig,
  candidates: string[],
  random: () => number = Math.random
): string | undefined {
  if (config.theme !== 'all') {
    return config.theme;
  }
  if (candidates.length === 0) {
    return undefined;
  }
  return candidates[Math.floor(random() * candidates.length)];
}

/** Récord vacío, para el primer arranque. */
export function emptyStreakRecord(): StreakRecord {
  return {
    bestScore: 0,
    bestRunUid: '',
    achievedAt: 0,
    runsPlayed: 0,
    lastScore: 0,
    lastPlayedAt: 0,
  };
}

/** ¿La puntuación supera el récord vigente? */
export function isNewRecord(score: number, record: StreakRecord | null): boolean {
  return score > (record?.bestScore ?? 0);
}

/**
 * Aplica una racha terminada al récord.
 *
 * Abandonar no penaliza: la racha lograda hasta ese momento cuenta igual que
 * una terminada por fallo, así salir de la app no castiga al usuario.
 */
export function applyRunToRecord(
  record: StreakRecord | null,
  run: StreakRun
): StreakRecord {
  const previous = record ?? emptyStreakRecord();
  const finishedAt = run.finishedAt ?? run.startedAt;
  const beatsRecord = isNewRecord(run.score, previous);

  return {
    ...previous,
    uidUser: run.uidUser ?? previous.uidUser,
    bestScore: beatsRecord ? run.score : previous.bestScore,
    bestRunUid: beatsRecord ? run.uid : previous.bestRunUid,
    achievedAt: beatsRecord ? finishedAt : previous.achievedAt,
    runsPlayed: previous.runsPlayed + 1,
    lastScore: run.score,
    lastPlayedAt: finishedAt,
  };
}
