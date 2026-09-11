import { inject, Injectable } from '@angular/core';

import { ChessGame, ChessPlatform } from '@cpark/models';
import {
  ChessComUserNotFoundError,
  createChessComProvider,
} from '@chesspark/chess-com-provider';
import {
  createLichessProvider,
  LichessUserNotFoundError,
} from '@chesspark/lichess-provider';
import {
  AccountStorageSummary,
  ArchiveStorageSummary,
  createGamesArchive,
  GamesSource,
  SyncProgress,
} from '@chesspark/game-reporter';

import { AnalyticsService } from './analytics.service';
import {
  ConnectedAccounts,
  DEFAULT_SETTINGS,
  GameAnalyticsSettings,
  HistoryRange,
  monthsForRange,
  rangeStart,
} from './game-analytics.util';

/** Se lanza cuando la plataforma no conoce ese nombre de usuario. */
export class UnknownUsernameError extends Error {
  constructor(public readonly platform: ChessPlatform) {
    super(`Usuario desconocido en ${platform}`);
    this.name = 'UnknownUsernameError';
  }
}

/**
 * Fachada de la pantalla de Análisis de partidas.
 *
 * Los componentes no hablan con las APIs ni con IndexedDB: conectan una cuenta,
 * piden que se ponga al día y reciben las partidas ya normalizadas. Quién es
 * chess.com y quién lichess deja de importar a partir de aquí.
 *
 * Las partidas descargadas se quedan en memoria mientras dura la navegación,
 * porque los filtros de la pantalla se recalculan a cada cambio y volver a
 * leer IndexedDB en cada uno se nota.
 */
@Injectable({
  providedIn: 'root',
})
export class GameAnalyticsService {
  private analytics = inject(AnalyticsService);

  private readonly SETTINGS_KEY = 'chessColate_game_analytics';

  private readonly chessCom = createChessComProvider();
  private readonly lichess = createLichessProvider();
  private readonly archive = createGamesArchive();

  /** Todas las partidas del último sincronizado, sin filtrar. */
  private games: ChessGame[] = [];

  // — Cuentas conectadas ————————————————————————————————————

  getSettings(): GameAnalyticsSettings {
    try {
      const json = localStorage.getItem(this.SETTINGS_KEY);
      if (!json) {
        return { ...DEFAULT_SETTINGS, accounts: { ...DEFAULT_SETTINGS.accounts } };
      }
      const stored = JSON.parse(json) as Partial<GameAnalyticsSettings>;
      return {
        ...DEFAULT_SETTINGS,
        ...stored,
        accounts: { ...DEFAULT_SETTINGS.accounts, ...stored.accounts },
      };
    } catch (error) {
      console.error('Error al leer los ajustes de análisis:', error);
      return { ...DEFAULT_SETTINGS, accounts: { ...DEFAULT_SETTINGS.accounts } };
    }
  }

  saveSettings(patch: Partial<GameAnalyticsSettings>): GameAnalyticsSettings {
    const settings = { ...this.getSettings(), ...patch };
    try {
      localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Error al guardar los ajustes de análisis:', error);
    }
    return settings;
  }

  /**
   * Comprueba que el nombre existe antes de guardarlo.
   *
   * Se hace antes de descargar nada: un nombre mal escrito descubierto tras
   * cuarenta peticiones es una espera tirada.
   */
  async verifyUsername(
    platform: ChessPlatform,
    username: string
  ): Promise<boolean> {
    const name = username.trim();
    if (!name) {
      return false;
    }

    try {
      return platform === 'chess.com'
        ? await this.chessCom.userExists(name)
        : await this.lichess.userExists(name);
    } catch (error) {
      console.warn(`[GameAnalytics] No se pudo comprobar ${name}:`, error);
      // Sin red no se puede decir que no exista; se deja pasar y ya fallará
      return true;
    }
  }

  // — Descarga ————————————————————————————————————————————————

  /**
   * Pone al día el archivo de las cuentas conectadas y devuelve todas sus
   * partidas juntas, ordenadas por fecha.
   *
   * Si una plataforma falla, la otra sigue: media respuesta es mejor que un
   * error, y la pantalla avisa de lo que faltó.
   */
  async sync(
    accounts: ConnectedAccounts,
    historyMonths: HistoryRange,
    onProgress?: (progress: SyncProgress) => void
  ): Promise<ChessGame[]> {
    const months = monthsForRange(historyMonths);
    const games: ChessGame[] = [];

    if (accounts.chesscom.trim()) {
      games.push(
        ...(await this.syncAccount(
          this.chessCom,
          accounts.chesscom.trim(),
          historyMonths,
          onProgress
        ))
      );
    }

    if (accounts.lichess.trim()) {
      games.push(
        ...(await this.syncAccount(
          this.lichess,
          accounts.lichess.trim(),
          historyMonths,
          onProgress
        ))
      );
    }

    this.games = games.sort((a, b) => a.playedAt - b.playedAt);

    void this.analytics.logEvent('game_analytics_synced', {
      platforms: [
        accounts.chesscom.trim() ? 'chesscom' : '',
        accounts.lichess.trim() ? 'lichess' : '',
      ]
        .filter(Boolean)
        .join('+'),
      months: months.length,
      games_count: this.games.length,
    });

    return this.games;
  }

  /**
   * Un archivo concreto. En chess.com se cruzan los meses pedidos con los que
   * la plataforma dice que tienen partidas, para no gastar peticiones —una por
   * segundo— en meses que se sabe vacíos.
   */
  private async syncAccount(
    source: GamesSource,
    username: string,
    historyMonths: HistoryRange,
    onProgress?: (progress: SyncProgress) => void
  ): Promise<ChessGame[]> {
    let months = monthsForRange(historyMonths);

    if (source.platform === 'chess.com') {
      try {
        const withGames = await this.chessCom.listArchiveMonths(username);
        const keys = new Set(
          withGames.map((month) => `${month.year}-${month.month}`)
        );
        months = months.filter((month) =>
          keys.has(`${month.year}-${month.month}`)
        );
      } catch (error) {
        if (error instanceof ChessComUserNotFoundError) {
          throw new UnknownUsernameError('chess.com');
        }
        console.warn('[GameAnalytics] No se pudo listar el archivo:', error);
      }
    }

    try {
      const result = await this.archive.sync(
        source,
        username,
        months,
        onProgress
      );
      return result.games;
    } catch (error) {
      if (error instanceof LichessUserNotFoundError) {
        throw new UnknownUsernameError('lichess');
      }
      throw error;
    }
  }

  /**
   * Lo que ya está en el dispositivo, sin tocar la red. Es lo que se pinta al
   * abrir la pantalla: los reportes aparecen al instante y la descarga, si
   * hace falta, va por detrás.
   *
   * Solo entra lo que cae dentro del rango elegido. En el dispositivo puede
   * haber más —si antes se eligió un historial más largo—, pero enseñarlo
   * haría que la pantalla dijera 24 meses con el selector en 6. Lo de fuera se
   * queda guardado: volver a ampliar el rango no lo descarga otra vez.
   */
  async loadStored(
    accounts: ConnectedAccounts,
    historyMonths: HistoryRange
  ): Promise<ChessGame[]> {
    const games: ChessGame[] = [];

    if (accounts.chesscom.trim()) {
      games.push(
        ...(await this.archive.getStoredGames(
          'chess.com',
          accounts.chesscom.trim()
        ))
      );
    }
    if (accounts.lichess.trim()) {
      games.push(
        ...(await this.archive.getStoredGames(
          'lichess',
          accounts.lichess.trim()
        ))
      );
    }

    const from = rangeStart(historyMonths);
    this.games = games
      .filter((game) => game.playedAt >= from)
      .sort((a, b) => a.playedAt - b.playedAt);
    return this.games;
  }

  /** Las partidas cargadas ahora mismo, sin filtrar. */
  get currentGames(): ChessGame[] {
    return this.games;
  }

  // — Almacenamiento ————————————————————————————————————————

  getStorageSummary(): Promise<ArchiveStorageSummary> {
    return this.archive.getStorageSummary();
  }

  getStorageByAccount(): Promise<AccountStorageSummary[]> {
    return this.archive.getStorageByAccount();
  }

  /** Desconecta una cuenta: borra sus partidas y la quita de los ajustes. */
  async disconnect(
    platform: ChessPlatform,
    username: string
  ): Promise<GameAnalyticsSettings> {
    await this.archive.deleteAccount(platform, username);
    this.games = this.games.filter((game) => game.source !== platform);

    const accounts = { ...this.getSettings().accounts };
    if (platform === 'chess.com') {
      accounts.chesscom = '';
    } else {
      accounts.lichess = '';
    }

    void this.analytics.logEvent('game_analytics_disconnected', {
      platform: platform === 'chess.com' ? 'chesscom' : 'lichess',
    });

    return this.saveSettings({ accounts });
  }

  /** Borra todo el archivo; lo llama el "borrar todo" de Almacenamiento. */
  async clearArchive(): Promise<void> {
    await this.archive.clear();
    this.games = [];
  }
}
