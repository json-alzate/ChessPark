/**
 * Lógica pura de la pantalla de Partidas (sin Angular ni plugins):
 * ajustes de reproducción, filtros de la lista y orden del modo TV.
 */

import { GameHeader } from '@chesspark/games-provider';

/** Velocidades ofrecidas, en milisegundos por jugada. */
export const PLAYBACK_SPEEDS = [500, 1000, 2000, 3000, 5000] as const;

export interface PlaybackSettings {
  msPerMove: number;
  soundEnabled: boolean;
  /** Modo TV: al terminar una partida, pasar a la siguiente. */
  autoNextGame: boolean;
  shuffle: boolean;
  loopCollection: boolean;
}

export const DEFAULT_PLAYBACK_SETTINGS: PlaybackSettings = {
  msPerMove: 2000,
  soundEnabled: true,
  autoNextGame: true,
  shuffle: false,
  loopCollection: true,
};

/** Filtros de la lista de partidas de un jugador. */
export type ResultFilter = 'all' | 'won' | 'drawn' | 'lost';
export type ColorFilter = 'all' | 'white' | 'black';

export interface GameFilters {
  /** Texto libre sobre el nombre del rival. */
  opponent: string;
  result: ResultFilter;
  color: ColorFilter;
}

export const EMPTY_FILTERS: GameFilters = {
  opponent: '',
  result: 'all',
  color: 'all',
};

/**
 * Con qué color jugó el dueño de la colección. Se decide por el apellido,
 * porque los PGN escriben 'Petrosian, Tigran V' y el id del paquete es
 * 'petrosian'.
 */
export function playedColor(
  header: GameHeader,
  playerId: string
): 'white' | 'black' | null {
  const id = playerId.toLowerCase();
  if (surnameOf(header.white).includes(id)) {
    return 'white';
  }
  if (surnameOf(header.black).includes(id)) {
    return 'black';
  }
  return null;
}

/** Apellido en minúsculas y sin acentos: 'Petrosian, Tigran V' → 'petrosian'. */
function surnameOf(name: string): string {
  return name
    .split(',')[0]
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** El rival del dueño de la colección en una partida. */
export function opponentOf(header: GameHeader, playerId: string): string {
  return playedColor(header, playerId) === 'white'
    ? header.black
    : header.white;
}

/** Cómo le fue al dueño de la colección: ganó, empató o perdió. */
export function outcomeFor(
  header: GameHeader,
  playerId: string
): 'won' | 'drawn' | 'lost' | null {
  if (header.result === '1/2-1/2') {
    return 'drawn';
  }
  const color = playedColor(header, playerId);
  if (!color || (header.result !== '1-0' && header.result !== '0-1')) {
    return null;
  }
  const whiteWon = header.result === '1-0';
  return (color === 'white') === whiteWon ? 'won' : 'lost';
}

/** Aplica los filtros de la pantalla del jugador. */
export function filterGames(
  headers: ReadonlyArray<GameHeader>,
  playerId: string,
  filters: GameFilters
): GameHeader[] {
  const search = filters.opponent.trim().toLowerCase();

  return headers.filter((header) => {
    if (search && !opponentOf(header, playerId).toLowerCase().includes(search)) {
      return false;
    }
    if (filters.color !== 'all' && playedColor(header, playerId) !== filters.color) {
      return false;
    }
    if (filters.result !== 'all' && outcomeFor(header, playerId) !== filters.result) {
      return false;
    }
    return true;
  });
}

/**
 * Orden en que el modo TV recorre las partidas. Con aleatorio activado se
 * baraja una vez al arrancar, no en cada salto: así "anterior" devuelve a la
 * partida que se acaba de ver, que es lo que espera cualquiera.
 */
export function buildPlayOrder(
  headers: ReadonlyArray<GameHeader>,
  shuffle: boolean
): number[] {
  const order = headers.map((header) => header.index);
  if (!shuffle) {
    return order;
  }

  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/**
 * Siguiente posición dentro del recorrido del TV. `null` cuando se acabó la
 * colección y la repetición está apagada.
 */
export function nextPosition(
  position: number,
  total: number,
  loop: boolean
): number | null {
  if (total === 0) {
    return null;
  }
  if (position + 1 < total) {
    return position + 1;
  }
  return loop ? 0 : null;
}

/** Tamaño legible: '1,1 MB'. Mismo criterio que la pantalla de Almacenamiento. */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) {
    return '0 KB';
  }
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) {
    return `${mb.toFixed(1).replace('.', ',')} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}
