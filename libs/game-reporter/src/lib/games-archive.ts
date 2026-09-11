import {
  ArchiveMonth,
  archiveMonthKey,
  archiveMonthOf,
  ChessGame,
  ChessPlatform,
} from '@cpark/models';

import { ArchiveCacheService } from './archive-cache.service';
import {
  AccountStorageSummary,
  ArchiveStorageSummary,
  CachedArchiveMonth,
  GamesSource,
  SyncProgress,
  SyncResult,
} from './types';

/**
 * Cuánto vale el mes en curso antes de volver a pedirlo. Los meses cerrados no
 * cambian nunca, así que se piden una sola vez y se quedan; el actual todavía
 * puede crecer, y una hora es un equilibrio razonable entre ver las partidas de
 * hoy y no machacar la API cada vez que se abre la pantalla.
 */
const CURRENT_MONTH_TTL_MS = 60 * 60 * 1000;

/**
 * El archivo local de partidas del usuario.
 *
 * Es la pieza entre los conectores y los reportes: decide qué meses hay que
 * pedir y cuáles ya están en el dispositivo, y deja siempre el archivo
 * completo listo para calcular. Si un mes falla, el resto sigue valiendo: media
 * descarga da media respuesta, no un error.
 */
export class GamesArchive {
  constructor(private readonly cache = new ArchiveCacheService()) {}

  /**
   * Pone al día los meses indicados y devuelve todas sus partidas.
   *
   * `onProgress` se llama una vez por mes resuelto, sirva del dispositivo o de
   * la red, para poder pintar una barra que no se quede parada.
   */
  async sync(
    source: GamesSource,
    username: string,
    months: ArchiveMonth[],
    onProgress?: (progress: SyncProgress) => void
  ): Promise<SyncResult> {
    const currentMonthKey = archiveMonthKey(archiveMonthOf(new Date()));
    const result: SyncResult = {
      games: [],
      monthsFetched: 0,
      monthsCached: 0,
      monthsFailed: 0,
    };

    let done = 0;

    for (const month of months) {
      const monthKey = archiveMonthKey(month);
      const cached = await this.cache.getMonth(
        source.platform,
        username,
        monthKey
      );

      const usable =
        cached !== null &&
        (monthKey !== currentMonthKey ||
          Date.now() - cached.fetchedAt < CURRENT_MONTH_TTL_MS);

      if (usable && cached) {
        result.games.push(...cached.games);
        result.monthsCached += 1;
        done += 1;
        onProgress?.({
          platform: source.platform,
          done,
          total: months.length,
          monthKey,
          fromNetwork: false,
        });
        continue;
      }

      try {
        const games = await source.fetchMonth(username, month);
        await this.cache.saveMonth(
          this.buildEntry(source.platform, username, monthKey, games)
        );
        result.games.push(...games);
        result.monthsFetched += 1;
      } catch (error) {
        console.warn(
          `[GamesArchive] No se pudo traer ${source.platform} ${monthKey}:`,
          error
        );
        // Lo guardado antes vale más que nada, aunque esté algo viejo
        if (cached) {
          result.games.push(...cached.games);
        }
        result.monthsFailed += 1;
      }

      done += 1;
      onProgress?.({
        platform: source.platform,
        done,
        total: months.length,
        monthKey,
        fromNetwork: true,
      });
    }

    result.games.sort((a, b) => a.playedAt - b.playedAt);
    return result;
  }

  /** Todas las partidas de una cuenta que ya están en el dispositivo. */
  async getStoredGames(
    platform: ChessPlatform,
    username: string
  ): Promise<ChessGame[]> {
    const months = await this.cache.listMonths(platform, username);
    return months
      .flatMap((month) => month.games)
      .sort((a, b) => a.playedAt - b.playedAt);
  }

  /** Los meses de una cuenta que ya están guardados. */
  async getStoredMonthKeys(
    platform: ChessPlatform,
    username: string
  ): Promise<string[]> {
    const months = await this.cache.listMonths(platform, username);
    return months.map((month) => month.monthKey);
  }

  async deleteAccount(
    platform: ChessPlatform,
    username: string
  ): Promise<void> {
    await this.cache.deleteAccount(platform, username);
  }

  async clear(): Promise<void> {
    await this.cache.clearAll();
  }

  getStorageSummary(): Promise<ArchiveStorageSummary> {
    return this.cache.getSummary();
  }

  getStorageByAccount(): Promise<AccountStorageSummary[]> {
    return this.cache.getSummaryByAccount();
  }

  /**
   * El mes tal como se guarda. El tamaño se mide sobre el PGN, que es el 95 %
   * de lo que ocupa: sirve para que Almacenamiento diga una cifra honesta sin
   * serializar dos veces cada mes.
   */
  private buildEntry(
    platform: ChessPlatform,
    username: string,
    monthKey: string,
    games: ChessGame[]
  ): CachedArchiveMonth {
    return {
      key: ArchiveCacheService.buildKey(platform, username, monthKey),
      platform,
      username: username.toLowerCase(),
      monthKey,
      games,
      fetchedAt: Date.now(),
      sizeBytes: games.reduce((total, game) => total + game.pgn.length, 0),
    };
  }
}

/** Instancia lista para usar, con su propio caché. */
export function createGamesArchive(cache?: ArchiveCacheService): GamesArchive {
  return new GamesArchive(cache);
}
