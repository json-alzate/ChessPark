/**
 * Fusión de récords entre el dispositivo y el perfil de la nube.
 *
 * Los dos lados pueden ir por delante: se juega sin conexión, se juega en el
 * móvil y luego en la web, se reinstala la app… Por eso no se elige "un ganador"
 * entero, sino que se toma lo mejor de cada lado campo a campo:
 *
 * - **La mejor marca** (`bestScore` y lo que la acompaña) es la más alta de las dos.
 * - **El último intento** viene del lado que jugó más recientemente.
 * - **El número de partidas** es el mayor de los dos, nunca la suma: sumar
 *   contaría dos veces lo que ya estaba sincronizado.
 *
 * Sin dependencias de Angular ni de almacenamiento, para poder testearla sola.
 */

import { Reto333Record, StreakRecord } from '@cpark/models';

/** Un récord de racha vacío no cuenta como copia: no hay nada que fusionar. */
export function hasStreakData(record: StreakRecord | null | undefined): boolean {
  return !!record && (record.runsPlayed > 0 || record.bestScore > 0);
}

/**
 * ¿Esta copia local es de otro usuario?
 *
 * Lo jugado sin sesión (sin dueño) sí se adopta al iniciar sesión: es el caso
 * de quien prueba la app y luego se registra. Lo jugado por **otra** cuenta en
 * el mismo dispositivo se descarta, para que nadie herede marcas ajenas.
 */
export function isFromAnotherUser(
  record: { uidUser?: string } | null | undefined,
  uidUser: string
): boolean {
  return !!record?.uidUser && record.uidUser !== uidUser;
}

export function mergeStreakRecords(
  local: StreakRecord | null | undefined,
  remote: StreakRecord | null | undefined
): StreakRecord | null {
  if (!hasStreakData(local)) {
    return hasStreakData(remote) ? (remote as StreakRecord) : null;
  }
  if (!hasStreakData(remote)) {
    return local as StreakRecord;
  }

  const localRecord = local as StreakRecord;
  const remoteRecord = remote as StreakRecord;

  // En empate manda el dispositivo: es lo que el usuario acaba de ver.
  const best =
    remoteRecord.bestScore > localRecord.bestScore ? remoteRecord : localRecord;
  const latest =
    remoteRecord.lastPlayedAt > localRecord.lastPlayedAt
      ? remoteRecord
      : localRecord;

  return {
    uidUser: localRecord.uidUser ?? remoteRecord.uidUser,
    bestScore: best.bestScore,
    bestRunUid: best.bestRunUid,
    achievedAt: best.achievedAt,
    runsPlayed: Math.max(localRecord.runsPlayed, remoteRecord.runsPlayed),
    lastScore: latest.lastScore,
    lastPlayedAt: latest.lastPlayedAt,
  };
}

export function mergeReto333Records(
  local: Reto333Record | null | undefined,
  remote: Reto333Record | null | undefined
): Reto333Record | null {
  if (!local) {
    return remote ?? null;
  }
  if (!remote) {
    return local;
  }

  const latest = remote.lastPlayedAt > local.lastPlayedAt ? remote : local;

  return {
    uidUser: local.uidUser ?? remote.uidUser,
    bestScore: Math.max(local.bestScore, remote.bestScore),
    // El resumen del último intento viaja junto: puntuación, elo, tiempo y si
    // llegó a los 333 describen la misma partida y mezclarlos mentiría.
    lastScore: latest.lastScore,
    maxElo: latest.maxElo,
    lastTime: latest.lastTime,
    timeString: latest.timeString,
    completed: latest.completed,
    lastPlayedAt: latest.lastPlayedAt,
  };
}

/**
 * ¿Hace falta escribir en Firestore?
 *
 * Se compara el resultado de la fusión con lo que ya hay en el perfil: si son
 * iguales, abrir sesión no gasta una escritura. Se comparan las claves ordenadas
 * porque el objeto que llega de Firestore no tiene por qué traerlas en el mismo
 * orden que el que construye la fusión.
 */
export function recordsEqual(
  a: Reto333Record | StreakRecord | null | undefined,
  b: Reto333Record | StreakRecord | null | undefined
): boolean {
  if (!a || !b) {
    return !a && !b;
  }

  const entries = (record: Reto333Record | StreakRecord) =>
    Object.entries(record)
      .filter(([, value]) => value !== undefined)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));

  return JSON.stringify(entries(a)) === JSON.stringify(entries(b));
}
