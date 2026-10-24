/**
 * La lógica pura de la campaña: qué ejercicio toca, cómo cambia el progreso con cada resultado y qué patrón se repasa.
 * Sin Angular ni almacenamiento: recibe un `RunnerCampaign` y devuelve otro nuevo, así se prueba con partidas escritas.
 */

import {
  BLOCK_ELO_OFFSETS,
  BLOCK_SIZE,
  CHAPTERS,
  FAIL_ELO_EASING,
  MAX_FAIL_EASING,
  MAX_RATING,
  MAX_START_RATING,
  MIN_START_RATING,
  POWER_IDS,
  RATING_EARLY_PUZZLES,
  RATING_K,
  RATING_K_EARLY,
  REVIEW_ELO_OFFSET,
  REVIEW_SIZE,
  RunnerPowerId,
  START_RATING_OFFSET,
} from './runner-curriculum';
import { DEFAULT_SKIN, isSkinId } from '../rendering/dog-skins';
import { CampaignEvent, CampaignStep, PatternStat, RunnerCampaign } from './runner-campaign.model';

export function newCampaign(): RunnerCampaign {
  return {
    version: 2,
    round: 0,
    chapter: 0,
    rating: 0,
    peakRating: 0,
    solvedInBlock: 0,
    failsInBlock: 0,
    puzzles: 0,
    mastery: {},
    powers: [],
    stars: [],
    review: null,
    seen: [],
    cookies: 0,
    days: 0,
    lastDay: '',
    skin: DEFAULT_SKIN,
    skins: [DEFAULT_SKIN],
  };
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const natural = (value: unknown, max = Number.MAX_SAFE_INTEGER): number =>
  isNumber(value) ? Math.min(Math.max(Math.floor(value), 0), max) : 0;

/**
 * Lo que había guardado, a salvo de datos rotos o de otra versión: lo que no se entienda se descarta y se parte de
 * una campaña nueva (perder el progreso es mejor que dejar el juego sin arrancar).
 */
export function sanitizeCampaign(raw: unknown): RunnerCampaign {
  const base = newCampaign();
  if (!raw || typeof raw !== 'object') {
    return base;
  }
  const data = raw as Partial<Record<keyof RunnerCampaign, unknown>>;
  if (data.version !== 2) {
    return base;
  }

  const mastery: Record<string, PatternStat> = {};
  if (data.mastery && typeof data.mastery === 'object') {
    for (const [theme, stat] of Object.entries(data.mastery as Record<string, Partial<PatternStat>>)) {
      if (stat && typeof stat === 'object') {
        mastery[theme] = {
          solved: natural(stat.solved),
          failed: natural(stat.failed),
          lastSeen: natural(stat.lastSeen),
        };
      }
    }
  }

  const powers = Array.isArray(data.powers)
    ? [...new Set(data.powers.filter((p): p is RunnerPowerId => POWER_IDS.includes(p as RunnerPowerId)))]
    : [];
  const stars = Array.isArray(data.stars) ? data.stars.map((s) => Math.min(Math.max(natural(s), 1), 3)) : [];
  const seen = Array.isArray(data.seen) ? [...new Set(data.seen.filter((s): s is string => typeof s === 'string'))] : [];

  let review: RunnerCampaign['review'] = null;
  const pending = data.review as Partial<{ theme: unknown; left: unknown }> | null | undefined;
  if (pending && typeof pending.theme === 'string' && natural(pending.left) > 0) {
    review = { theme: pending.theme, left: natural(pending.left, REVIEW_SIZE) };
  }

  const rating = natural(data.rating, MAX_RATING);
  const skins = Array.isArray(data.skins) ? [...new Set([DEFAULT_SKIN, ...data.skins.filter(isSkinId)])] : [DEFAULT_SKIN];
  const skin = isSkinId(data.skin) && skins.includes(data.skin) ? data.skin : DEFAULT_SKIN;
  return {
    version: 2,
    cookies: natural(data.cookies),
    days: natural(data.days, 9999),
    lastDay: typeof data.lastDay === 'string' && DAY_PATTERN.test(data.lastDay) ? data.lastDay : '',
    skin,
    skins,
    round: natural(data.round, 999),
    chapter: natural(data.chapter, CHAPTERS.length - 1),
    rating,
    peakRating: Math.max(natural(data.peakRating, MAX_RATING), rating),
    solvedInBlock: natural(data.solvedInBlock, BLOCK_SIZE - 1),
    failsInBlock: natural(data.failsInBlock, 99),
    puzzles: natural(data.puzzles),
    mastery,
    powers,
    stars: stars.slice(0, CHAPTERS.length),
    review,
    seen,
  };
}

/** Cuántos capítulos se llevan vencidos en total, contando las rondas anteriores: crece sin tope y marca lo difícil que es la carrera. */
export function depthOf(campaign: RunnerCampaign): number {
  return campaign.round * CHAPTERS.length + campaign.chapter;
}

/** Los temas ya aprendidos: los capítulos vencidos de la ronda (o todos, a partir de la segunda). */
export function learnedThemes(campaign: RunnerCampaign): string[] {
  const learned = campaign.round > 0 ? CHAPTERS : CHAPTERS.slice(0, campaign.chapter);
  return learned.map((chapter) => chapter.theme);
}

/**
 * El ELO con que empieza el perrito: algo por debajo del del usuario (para ganar confianza y que el avance se note),
 * dentro de unos límites razonables.
 */
export function startingRating(userElo: number): number {
  const elo = Number.isFinite(userElo) ? userElo : 1200;
  return Math.min(Math.max(Math.round((elo + START_RATING_OFFSET) / 10) * 10, MIN_START_RATING), MAX_START_RATING);
}

/** El ELO tras un ejercicio, con la fórmula de ajedrez: resolver uno difícil sube mucho; fallar uno fácil baja mucho. */
export function ratingAfter(rating: number, puzzleRating: number, solved: boolean, played: number): number {
  const k = played < RATING_EARLY_PUZZLES ? RATING_K_EARLY : RATING_K;
  const expected = 1 / (1 + Math.pow(10, (puzzleRating - rating) / 400));
  const next = rating + Math.round(k * ((solved ? 1 : 0) - expected));
  return Math.min(Math.max(next, 100), MAX_RATING);
}

/**
 * El patrón que peor se tiene entre los ya aprendidos: el que más se ha fallado y el que más tiempo hace que no se ve.
 * `exclude` deja fuera el que acaba de jugarse. Devuelve `null` si todavía no hay ninguno que repasar.
 */
export function weakestPattern(campaign: RunnerCampaign, exclude?: string): string | null {
  const candidates = learnedThemes(campaign).filter((theme) => theme !== exclude);
  let best: { theme: string; score: number } | null = null;
  for (const theme of candidates) {
    const stat = campaign.mastery[theme];
    const played = stat ? stat.solved + stat.failed : 0;
    const failRate = played > 0 ? stat.failed / played : 0.5;
    const stale = Math.min((campaign.puzzles - (stat?.lastSeen ?? 0)) / 40, 1);
    const score = failRate * 2 + stale;
    // En un empate se queda el primero (el más antiguo): así el resultado no depende del azar
    if (!best || score > best.score) {
      best = { theme, score };
    }
  }
  return best?.theme ?? null;
}

/** Qué toca jugar ahora. */
export function currentStep(campaign: RunnerCampaign): CampaignStep {
  if (campaign.review) {
    return {
      kind: 'review',
      chapter: campaign.chapter,
      theme: campaign.review.theme,
      index: Math.max(0, REVIEW_SIZE - campaign.review.left),
      total: REVIEW_SIZE,
      eloOffset: REVIEW_ELO_OFFSET,
    };
  }
  const chapter = CHAPTERS[campaign.chapter];
  const easing = Math.min(campaign.failsInBlock, MAX_FAIL_EASING) * FAIL_ELO_EASING;
  return {
    kind: 'block',
    chapter: campaign.chapter,
    theme: chapter.theme,
    index: campaign.solvedInBlock,
    total: BLOCK_SIZE,
    eloOffset: (BLOCK_ELO_OFFSETS[campaign.solvedInBlock] ?? 0) - easing,
  };
}

/** Estrellas de un capítulo según lo que se falló: ninguno, 3; uno, 2; más, 1. */
export function starsForFails(fails: number): number {
  return fails === 0 ? 3 : fails === 1 ? 2 : 1;
}

/** Apunta un ejercicio jugado a las estadísticas del patrón. */
function withStat(campaign: RunnerCampaign, theme: string, solved: boolean): RunnerCampaign {
  const puzzles = campaign.puzzles + 1;
  const previous = campaign.mastery[theme] ?? { solved: 0, failed: 0, lastSeen: 0 };
  return {
    ...campaign,
    puzzles,
    mastery: {
      ...campaign.mastery,
      [theme]: {
        solved: previous.solved + (solved ? 1 : 0),
        failed: previous.failed + (solved ? 0 : 1),
        lastSeen: puzzles,
      },
    },
  };
}

/**
 * Lo que cambia al acabar un ejercicio del paso actual. Resolver avanza el bloque (o el repaso); fallar no avanza
 * y hace el siguiente ejercicio del mismo patrón algo más fácil. Con el ELO del ejercicio (`puzzleRating`) también se
 * ajusta el ELO del perrito. Al completar un capítulo se gana su poder (si lo trae), se abre un repaso si ya hay algo
 * que repasar y se pasa al siguiente; al vencer al último guardián empieza otra ronda.
 */
export function applyResult(
  campaign: RunnerCampaign,
  solved: boolean,
  puzzleRating?: number
): { campaign: RunnerCampaign; events: CampaignEvent[] } {
  const step = currentStep(campaign);
  const events: CampaignEvent[] = [];
  let next = withStat(campaign, step.theme, solved);

  if (puzzleRating !== undefined && Number.isFinite(puzzleRating) && campaign.rating > 0) {
    const rating = ratingAfter(campaign.rating, puzzleRating, solved, campaign.puzzles);
    next = { ...next, rating, peakRating: Math.max(next.peakRating, rating) };
    if (rating !== campaign.rating) {
      events.push({ kind: 'rating', from: campaign.rating, to: rating });
    }
  }

  if (step.kind === 'review') {
    if (solved && next.review) {
      const left = next.review.left - 1;
      next = { ...next, review: left > 0 ? { ...next.review, left } : null };
      if (left <= 0) {
        events.push({ kind: 'reviewDone' });
      }
    }
    return { campaign: next, events };
  }

  if (!solved) {
    return { campaign: { ...next, failsInBlock: next.failsInBlock + 1 }, events };
  }

  const solvedInBlock = next.solvedInBlock + 1;
  if (solvedInBlock < BLOCK_SIZE) {
    return { campaign: { ...next, solvedInBlock }, events };
  }

  // Capítulo terminado
  const chapter = CHAPTERS[next.chapter];
  const stars = starsForFails(next.failsInBlock);
  const power = chapter.power;
  const firstTime = power !== null && !next.powers.includes(power);
  const bestStars = [...next.stars];
  bestStars[next.chapter] = Math.max(bestStars[next.chapter] ?? 0, stars);
  const lastOfRound = next.chapter + 1 >= CHAPTERS.length;
  next = {
    ...next,
    round: lastOfRound ? next.round + 1 : next.round,
    chapter: lastOfRound ? 0 : next.chapter + 1,
    solvedInBlock: 0,
    failsInBlock: 0,
    powers: firstTime && power ? [...next.powers, power] : next.powers,
    stars: lastOfRound ? [] : bestStars,
  };
  events.push({ kind: 'chapterComplete', chapter: campaign.chapter, stars, power, firstTime });
  if (lastOfRound) {
    events.push({ kind: 'roundComplete', round: campaign.round });
  }

  // Un repaso del patrón más flojo de los anteriores, antes del capítulo nuevo
  const theme = weakestPattern(next, chapter.theme);
  if (theme) {
    next = { ...next, review: { theme, left: REVIEW_SIZE } };
    events.push({ kind: 'reviewStart', theme });
  }
  return { campaign: next, events };
}

/** Marca algo de la historia o de las lecciones como visto. */
export function markSeen(campaign: RunnerCampaign, key: string): RunnerCampaign {
  return campaign.seen.includes(key) ? campaign : { ...campaign, seen: [...campaign.seen, key] };
}

export function hasSeen(campaign: RunnerCampaign, key: string): boolean {
  return campaign.seen.includes(key);
}

// ------------------------------------------------------------------------------- días seguidos

/** El día de hoy del dispositivo como `AAAA-MM-DD`. */
export function dayKey(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Cuántos días hay de un `AAAA-MM-DD` a otro (con horas de mediodía para que el cambio de hora no cuente). */
function daysBetween(from: string, to: string): number {
  const at = (key: string) => new Date(`${key}T12:00:00`).getTime();
  return Math.round((at(to) - at(from)) / 86_400_000);
}

/**
 * Apunta que hoy se jugó: el mismo día no cambia nada, al día siguiente la racha sube, y tras un hueco vuelve a uno.
 * Devuelve `changed` si la racha subió o empezó (para celebrarlo).
 */
export function touchDay(campaign: RunnerCampaign, today: string): { campaign: RunnerCampaign; changed: boolean } {
  if (campaign.lastDay === today) {
    return { campaign, changed: false };
  }
  const consecutive = campaign.lastDay !== '' && daysBetween(campaign.lastDay, today) === 1;
  return { campaign: { ...campaign, lastDay: today, days: consecutive ? campaign.days + 1 : 1 }, changed: true };
}

/** La racha que sigue viva hoy: la guardada si se jugó hoy o ayer; si no, se rompió. */
export function activeDayStreak(campaign: RunnerCampaign, today: string): number {
  if (campaign.lastDay === '') {
    return 0;
  }
  const gap = daysBetween(campaign.lastDay, today);
  return gap === 0 || gap === 1 ? campaign.days : 0;
}
