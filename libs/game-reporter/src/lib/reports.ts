import {
  ChessGame,
  ChessPlatform,
  opponentRating,
  outcomeForUser,
  TimeClass,
  userRating,
} from '@cpark/models';

import {
  ActivityDay,
  GeneralStats,
  OpeningStats,
  RatingDataPoint,
  RecordBreakdown,
} from './types';

/** Un contador vacío, para ir sumando encima. */
function emptyRecord(): RecordBreakdown {
  return { games: 0, wins: 0, losses: 0, draws: 0, winRate: 0 };
}

/** Suma una partida al contador, sin tocar todavía el porcentaje. */
function addGame(record: RecordBreakdown, game: ChessGame): void {
  record.games += 1;
  switch (outcomeForUser(game)) {
    case 'win':
      record.wins += 1;
      break;
    case 'loss':
      record.losses += 1;
      break;
    default:
      record.draws += 1;
  }
}

/**
 * Cierra el contador calculando el porcentaje.
 *
 * Las tablas cuentan medio punto, así que un empate vale medio: con la cuenta
 * de solo victorias, un jugador que hace tablas todo el rato aparecería igual
 * que uno que pierde todo el rato.
 */
function closeRecord(record: RecordBreakdown): RecordBreakdown {
  record.winRate = record.games
    ? (record.wins + record.draws / 2) / record.games
    : 0;
  return record;
}

/**
 * El rating del usuario partida a partida, ordenado por fecha.
 *
 * Se devuelve un punto por partida y no una media diaria: la gráfica se dibuja
 * por tiempo, y agrupar escondería justo las rachas que se quieren ver.
 */
export function getRatingProgress(games: ChessGame[]): RatingDataPoint[] {
  return games
    .filter((game) => userRating(game) > 0)
    .map((game) => ({
      date: game.playedAt,
      rating: userRating(game),
      platform: game.source,
    }))
    .sort((a, b) => a.date - b.date);
}

/** Las cifras de cabecera: cuántas, cómo fueron y contra quién. */
export function getGeneralStats(games: ChessGame[]): GeneralStats {
  const total = emptyRecord();
  const byPlatform: Partial<Record<ChessPlatform, RecordBreakdown>> = {};
  const byTimeClass: Partial<Record<TimeClass, RecordBreakdown>> = {};
  const byColor = { white: emptyRecord(), black: emptyRecord() };

  let opponentRatingSum = 0;
  let opponentRatingCount = 0;
  let firstPlayedAt = 0;
  let lastPlayedAt = 0;

  const sorted = [...games].sort((a, b) => a.playedAt - b.playedAt);

  for (const game of sorted) {
    addGame(total, game);

    byPlatform[game.source] ??= emptyRecord();
    addGame(byPlatform[game.source] as RecordBreakdown, game);

    byTimeClass[game.timeClass] ??= emptyRecord();
    addGame(byTimeClass[game.timeClass] as RecordBreakdown, game);

    addGame(byColor[game.userColor], game);

    const rival = opponentRating(game);
    if (rival > 0) {
      opponentRatingSum += rival;
      opponentRatingCount += 1;
    }

    if (!firstPlayedAt) {
      firstPlayedAt = game.playedAt;
    }
    lastPlayedAt = game.playedAt;
  }

  closeRecord(total);
  Object.values(byPlatform).forEach(closeRecord);
  Object.values(byTimeClass).forEach(closeRecord);
  closeRecord(byColor.white);
  closeRecord(byColor.black);

  return {
    ...total,
    byPlatform,
    byTimeClass,
    byColor,
    averageOpponentRating: opponentRatingCount
      ? Math.round(opponentRatingSum / opponentRatingCount)
      : 0,
    currentStreak: currentStreak(sorted),
    firstPlayedAt,
    lastPlayedAt,
  };
}

/**
 * La racha con la que está ahora mismo: positiva si son victorias, negativa si
 * son derrotas y cero si la última fue tablas. Se cuenta hacia atrás desde la
 * partida más reciente.
 */
function currentStreak(sortedGames: ChessGame[]): number {
  let streak = 0;

  for (let i = sortedGames.length - 1; i >= 0; i--) {
    const outcome = outcomeForUser(sortedGames[i]);
    if (outcome === 'draw') {
      break;
    }
    if (streak === 0) {
      streak = outcome === 'win' ? 1 : -1;
      continue;
    }
    if ((streak > 0) !== (outcome === 'win')) {
      break;
    }
    streak += streak > 0 ? 1 : -1;
  }

  return streak;
}

/**
 * Cómo le va con cada apertura, de la más jugada a la menos.
 *
 * Se agrupa por código ECO y no por nombre: chess.com y lichess bautizan la
 * misma apertura de formas distintas, y agrupar por nombre partiría en dos
 * filas lo que es una sola apertura.
 */
export function getOpeningStats(games: ChessGame[]): OpeningStats[] {
  const byEco = new Map<string, OpeningStats>();

  for (const game of games) {
    const eco = game.opening?.eco;
    if (!eco) {
      continue;
    }

    let row = byEco.get(eco);
    if (!row) {
      row = {
        ...emptyRecord(),
        eco,
        name: game.opening?.name || eco,
        asWhite: 0,
        asBlack: 0,
      };
      byEco.set(eco, row);
    }

    addGame(row, game);
    if (game.userColor === 'white') {
      row.asWhite += 1;
    } else {
      row.asBlack += 1;
    }
  }

  return [...byEco.values()]
    .map(closeRecord)
    .map((row) => row as OpeningStats)
    .sort((a, b) => b.games - a.games || a.eco.localeCompare(b.eco));
}

/**
 * Cuántas partidas por día, sin huecos entre el primer y el último día con
 * actividad: el mapa necesita también los días en blanco para dibujarlos.
 */
export function getActivityHeatmap(games: ChessGame[]): ActivityDay[] {
  if (games.length === 0) {
    return [];
  }

  const counts = new Map<string, number>();
  let first = Number.POSITIVE_INFINITY;
  let last = 0;

  for (const game of games) {
    const key = toDayKey(game.playedAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    first = Math.min(first, game.playedAt);
    last = Math.max(last, game.playedAt);
  }

  const days: ActivityDay[] = [];
  const cursor = startOfDay(new Date(first));
  const end = startOfDay(new Date(last));

  while (cursor <= end) {
    const key = toDayKey(cursor.getTime());
    days.push({ date: key, games: counts.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

/** 'YYYY-MM-DD' en la zona horaria del dispositivo. */
export function toDayKey(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
