import { ChessGame, UserOutcome, outcomeForUser } from '@chesspark/models';

import {
  CUSTOM_TAG_PREFIX,
  REFLECTION_LIMITS,
  SYSTEM_TAG_KEYS,
  TAG_LABEL_MAX_LENGTH,
} from '@features/game-reflection/config/game-reflection.config';
import {
  GameReflection,
  GameTag,
  ReflectionList,
  TagOption,
} from '@features/game-reflection/models/game-reflection.model';

/** Una reflexión sin nada marcado no se guarda. */
export interface ReflectionSelection {
  best: string[];
  improve: string[];
}

/** Cuántas veces sale un tag y cómo terminaron esas partidas. */
export interface TagUsage {
  id: string;
  count: number;
  outcomes: Record<UserOutcome, number>;
}

/**
 * La clave de una partida en Firestore: la plataforma más el id que ella le
 * dio, que no cambia aunque se borre la descarga y se vuelva a bajar.
 *
 * Un id de documento no admite '/', y el respaldo de chess.com puede ser una
 * URL, así que se sustituye.
 */
export function gameKeyOf(game: Pick<ChessGame, 'source' | 'id'>): string {
  const platform = game.source === 'chess.com' ? 'chesscom' : 'lichess';
  return `${platform}:${game.id.replace(/\//g, '_')}`;
}

/** Quita espacios de más: 'Cambios   de dama ' → 'Cambios de dama'. */
export function cleanTagLabel(label: string): string {
  return label.replace(/\s+/g, ' ').trim();
}

/**
 * La forma con la que se comparan nombres: sin mayúsculas ni tildes, para que
 * 'Táctica' y 'tactica' sean el mismo tag.
 */
export function tagSearchKey(label: string): string {
  return cleanTagLabel(label)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** true si el texto sirve como nombre de un tag propio nuevo. */
export function isValidTagLabel(label: string): boolean {
  const clean = cleanTagLabel(label);
  return clean.length > 0 && clean.length <= TAG_LABEL_MAX_LENGTH;
}

/** El id de un tag propio recién creado. */
export function newCustomTagId(random: () => number = Math.random): string {
  return `${CUSTOM_TAG_PREFIX}${random().toString(36).slice(2, 8).padEnd(6, '0')}`;
}

export function isCustomTagId(id: string): boolean {
  return id.startsWith(CUSTOM_TAG_PREFIX);
}

/** Las listas de una reflexión, o vacías si no hay. */
export function selectionOf(
  reflection: Pick<GameReflection, 'best' | 'improve'> | null
): ReflectionSelection {
  return {
    best: [...(reflection?.best ?? [])],
    improve: [...(reflection?.improve ?? [])],
  };
}

export function isSelectionEmpty(selection: ReflectionSelection): boolean {
  return selection.best.length === 0 && selection.improve.length === 0;
}

/** Cuántos tags más caben en una lista. */
export function remainingSlots(
  selection: ReflectionSelection,
  list: ReflectionList
): number {
  return Math.max(0, REFLECTION_LIMITS[list] - selection[list].length);
}

/**
 * Añade un tag a una lista. Se queda igual si la lista está llena o si el tag
 * ya está en alguna de las dos: lo mejor y lo que mejorar no comparten tag.
 */
export function addTagToSelection(
  selection: ReflectionSelection,
  list: ReflectionList,
  tagId: string
): ReflectionSelection {
  const alreadyChosen =
    selection.best.includes(tagId) || selection.improve.includes(tagId);
  if (alreadyChosen || remainingSlots(selection, list) === 0) {
    return selection;
  }
  return { ...selection, [list]: [...selection[list], tagId] };
}

export function removeTagFromSelection(
  selection: ReflectionSelection,
  list: ReflectionList,
  tagId: string
): ReflectionSelection {
  return {
    ...selection,
    [list]: selection[list].filter((id) => id !== tagId),
  };
}

/**
 * Las opciones que se ofrecen mientras se escribe.
 *
 * Salen primero los tags propios (los más recientes antes) y luego los del
 * sistema, y se quedan fuera los que ya están elegidos en cualquiera de las
 * dos listas. Con el campo vacío se ofrece todo; al escribir, lo que contiene
 * el texto, empezando por lo que empieza por él.
 */
export function buildTagOptions(params: {
  query: string;
  customTags: GameTag[];
  /** Texto visible de una clave del sistema, ya traducido. */
  systemLabel: (key: string) => string;
  chosen: string[];
}): TagOption[] {
  const { query, customTags, systemLabel, chosen } = params;
  const needle = tagSearchKey(query);

  const custom: TagOption[] = customTags
    .filter((tag) => !tag.archived)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((tag) => ({ id: tag.id, label: tag.label, system: false }));
  const system: TagOption[] = SYSTEM_TAG_KEYS.map((key) => ({
    id: key,
    label: systemLabel(key),
    system: true,
  }));

  const candidates = [...custom, ...system].filter(
    (option) => !chosen.includes(option.id)
  );
  if (!needle) {
    return candidates;
  }

  const matches = candidates.filter((option) =>
    tagSearchKey(option.label).includes(needle)
  );
  const startsWith = (option: TagOption) =>
    tagSearchKey(option.label).startsWith(needle);
  // sort estable: dentro de cada grupo se conserva el orden de arriba
  return [
    ...matches.filter(startsWith),
    ...matches.filter((option) => !startsWith(option)),
  ];
}

/**
 * El tag ya existente que se llama igual que el texto (sin mayúsculas ni
 * tildes), entre los propios y los del sistema; evita crear 'tactica' si ya
 * está 'Táctica'.
 */
export function findTagByLabel(
  label: string,
  customTags: GameTag[],
  systemLabel: (key: string) => string
): TagOption | null {
  const needle = tagSearchKey(label);
  if (!needle) {
    return null;
  }

  const custom = customTags.find((tag) => tagSearchKey(tag.label) === needle);
  if (custom) {
    return { id: custom.id, label: custom.label, system: false };
  }

  const key = SYSTEM_TAG_KEYS.find(
    (systemKey) => tagSearchKey(systemLabel(systemKey)) === needle
  );
  return key ? { id: key, label: systemLabel(key), system: true } : null;
}

/** El texto visible de un id guardado; vacío si el tag ya no existe. */
export function labelOfTag(
  id: string,
  customTags: GameTag[],
  systemLabel: (key: string) => string
): string {
  if (isCustomTagId(id)) {
    return customTags.find((tag) => tag.id === id)?.label ?? '';
  }
  return SYSTEM_TAG_KEYS.includes(id) ? systemLabel(id) : '';
}

/** La reflexión lista para guardar. */
export function buildReflection(
  game: ChessGame,
  selection: ReflectionSelection,
  now: number
): GameReflection {
  return {
    gameKey: gameKeyOf(game),
    platform: game.source,
    playedAt: game.playedAt,
    outcome: outcomeForUser(game),
    best: selection.best,
    improve: selection.improve,
    updatedAt: now,
  };
}

/**
 * Cuántas veces sale cada tag en una de las dos listas y cómo terminaron esas
 * partidas, de más a menos frecuente. Es la base de las estadísticas.
 */
export function summarizeTags(
  reflections: GameReflection[],
  list: ReflectionList
): TagUsage[] {
  const byTag = new Map<string, TagUsage>();

  for (const reflection of reflections) {
    for (const id of reflection[list]) {
      const usage = byTag.get(id) ?? {
        id,
        count: 0,
        outcomes: { win: 0, draw: 0, loss: 0 },
      };
      usage.count++;
      usage.outcomes[reflection.outcome]++;
      byTag.set(id, usage);
    }
  }

  return [...byTag.values()].sort((a, b) => b.count - a.count);
}
