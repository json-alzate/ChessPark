import { ArchiveMonth, ChessGame, ChessPlatform, TimeClass } from '@cpark/models';

/**
 * Lo que hace falta saber de un conector para poder alimentar el archivo.
 *
 * Es un contrato estructural a propósito: los conectores no importan nada de
 * esta lib, simplemente encajan. Así el flujo de dependencias sigue siendo
 * conectores → archivo → reportes, sin vueltas.
 */
export interface GamesSource {
  readonly platform: ChessPlatform;
  fetchMonth(username: string, month: ArchiveMonth): Promise<ChessGame[]>;
}

/** Un mes de un usuario guardado en el dispositivo. */
export interface CachedArchiveMonth {
  /** 'lichess:magnus:2026-03'. */
  key: string;
  platform: ChessPlatform;
  /** En minúsculas: las plataformas no distinguen mayúsculas. */
  username: string;
  /** '2026-03'. */
  monthKey: string;
  games: ChessGame[];
  /** Cuándo se descargó, en milisegundos. */
  fetchedAt: number;
  /** Tamaño aproximado en el disco, para la pantalla de Almacenamiento. */
  sizeBytes: number;
}

/** Una cuenta conectada, tal como se guarda. */
export interface ConnectedAccount {
  platform: ChessPlatform;
  username: string;
}

/** Cómo va la descarga de un archivo. */
export interface SyncProgress {
  platform: ChessPlatform;
  /** Meses ya resueltos (descargados o leídos del dispositivo). */
  done: number;
  /** Meses en total. */
  total: number;
  /** El mes que se está resolviendo ahora: '2026-03'. */
  monthKey: string;
  /** true si ese mes hubo que pedirlo a la plataforma. */
  fromNetwork: boolean;
}

/** El resultado de sincronizar un archivo. */
export interface SyncResult {
  games: ChessGame[];
  /** Meses que hubo que pedir a la plataforma. */
  monthsFetched: number;
  /** Meses que ya estaban en el dispositivo. */
  monthsCached: number;
  /** Meses que fallaron; el resto del archivo sigue siendo válido. */
  monthsFailed: number;
}

/** Lo que la pantalla puede acotar antes de calcular los reportes. */
export interface ReportFilters {
  platform?: ChessPlatform | 'both';
  /** Familias de tiempo a incluir; vacío o ausente = todas. */
  timeClasses?: TimeClass[];
  /** Solo partidas jugadas a partir de esta fecha. */
  dateFrom?: Date;
  /** Solo partidas jugadas hasta esta fecha. */
  dateTo?: Date;
  /** Solo partidas con al menos estos segundos de tiempo base. */
  timeControlMin?: number;
  /** Solo partidas con exactamente estos segundos de tiempo base. */
  timeControlExact?: number;
  /** Solo partidas con este color. */
  color?: 'white' | 'black';
}

/** Un punto de la gráfica de progreso de rating. */
export interface RatingDataPoint {
  /** Milisegundos UTC. */
  date: number;
  rating: number;
  platform: ChessPlatform;
}

/** El desglose de una serie de partidas. */
export interface RecordBreakdown {
  games: number;
  wins: number;
  losses: number;
  draws: number;
  /** De 0 a 1; 0 cuando no hay partidas. */
  winRate: number;
}

/** Las cifras de cabecera del reporte. */
export interface GeneralStats extends RecordBreakdown {
  byPlatform: Partial<Record<ChessPlatform, RecordBreakdown>>;
  byTimeClass: Partial<Record<TimeClass, RecordBreakdown>>;
  byColor: Record<'white' | 'black', RecordBreakdown>;
  /** Rating medio del rival; 0 si ninguna partida lo trae. */
  averageOpponentRating: number;
  /** Racha actual de victorias (negativa si es de derrotas). */
  currentStreak: number;
  /** La partida más antigua y la más reciente, en milisegundos. */
  firstPlayedAt: number;
  lastPlayedAt: number;
}

/** Una fila de la tabla de aperturas. */
export interface OpeningStats extends RecordBreakdown {
  eco: string;
  name: string;
  asWhite: number;
  asBlack: number;
}

/** Un día del mapa de actividad. */
export interface ActivityDay {
  /** 'YYYY-MM-DD' en la zona horaria del dispositivo. */
  date: string;
  games: number;
}

/** Lo que ocupa el archivo descargado, para la pantalla de Almacenamiento. */
export interface ArchiveStorageSummary {
  months: number;
  games: number;
  sizeBytes: number;
}

/** Lo guardado de una cuenta concreta. */
export interface AccountStorageSummary extends ArchiveStorageSummary {
  platform: ChessPlatform;
  username: string;
}
