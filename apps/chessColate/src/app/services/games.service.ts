import { inject, Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { KeepAwake } from '@capacitor-community/keep-awake';

import {
  buildGame,
  createGamesProvider,
  GameCollectionInfo,
  GameHeader,
  GamesStorageSummary,
  ParsedGame,
  parsePackHeaders,
} from '@chesspark/games-provider';

import { AnalyticsService } from './analytics.service';
import {
  DEFAULT_PLAYBACK_SETTINGS,
  PlaybackSettings,
} from './games.util';

/** Un paquete abierto: sus cabeceras y los textos de cada partida. */
export interface OpenPack {
  collection: GameCollectionInfo;
  headers: GameHeader[];
  games: string[];
}

/**
 * Fachada de la pantalla de Partidas.
 *
 * Los componentes no hablan con el proveedor ni con el plugin de pantalla: solo
 * piden el catálogo, abren un paquete y piden partidas sueltas.
 *
 * El paquete abierto se guarda en memoria mientras se navega entre la lista y
 * el reproductor: cortar 4.310 partidas cada vez que se vuelve atrás sería
 * tirar 74 ms por gusto.
 */
@Injectable({
  providedIn: 'root',
})
export class GamesService {
  private analytics = inject(AnalyticsService);
  private provider = createGamesProvider();

  private readonly SETTINGS_KEY = 'chessColate_games_playback';

  /** Paquete abierto ahora mismo; solo uno cada vez. */
  private openPack: OpenPack | null = null;

  // — Catálogo ————————————————————————————————————————————————

  /** Las colecciones publicadas. Sale de lo guardado si aún vale. */
  getCatalog(options: { forceRefresh?: boolean } = {}): Promise<
    GameCollectionInfo[]
  > {
    return this.provider.getCatalog(options);
  }

  getCollection(id: string): Promise<GameCollectionInfo | null> {
    return this.provider.getCollection(id);
  }

  getDownloadedIds(): Promise<string[]> {
    return this.provider.getDownloadedIds();
  }

  isDownloaded(id: string): Promise<boolean> {
    return this.provider.isDownloaded(id);
  }

  /** Descarga un paquete avisando del avance (fracción de 0 a 1, o null). */
  async download(
    collection: GameCollectionInfo,
    onProgress?: (fraction: number | null) => void
  ): Promise<void> {
    await this.provider.downloadPack(collection, onProgress);

    void this.analytics.logEvent('games_pack_downloaded', {
      player: collection.id,
      games: collection.games,
      size_kb: Math.round(collection.sizeBytes / 1024),
    });
  }

  async deletePack(id: string): Promise<void> {
    await this.provider.deletePack(id);
    if (this.openPack?.collection.id === id) {
      this.openPack = null;
    }
    void this.analytics.logEvent('games_pack_deleted', { player: id });
  }

  getStorageSummary(): Promise<GamesStorageSummary> {
    return this.provider.getStorageSummary();
  }

  /**
   * Las colecciones que están en el dispositivo, con sus datos del catálogo.
   * Lo usa la pantalla de Almacenamiento para listarlas junto a los puzzles.
   */
  async getDownloadedCollections(): Promise<GameCollectionInfo[]> {
    const [ids, catalog] = await Promise.all([
      this.provider.getDownloadedIds(),
      this.provider.getCatalog(),
    ]);

    return catalog.filter((collection) => ids.includes(collection.id));
  }

  /** Borra todos los paquetes; lo llama el "borrar todo" de Almacenamiento. */
  async clearGamePacks(): Promise<void> {
    await this.provider.clearAllPacks();
    this.openPack = null;
  }

  // — Paquete abierto ————————————————————————————————————————

  /**
   * Abre un paquete: descarga si hace falta y saca las cabeceras de todas sus
   * partidas. Las posiciones **no** se derivan aquí (ver `getGame`).
   */
  async openCollection(
    collection: GameCollectionInfo,
    onProgress?: (fraction: number | null) => void
  ): Promise<OpenPack> {
    const current = this.openPack;
    if (current && current.collection.id === collection.id) {
      return current;
    }

    const pgn = await this.provider.getPackPgn(collection, onProgress);
    const { headers, games } = parsePackHeaders(pgn);

    this.openPack = { collection, headers, games };
    return this.openPack;
  }

  /** El paquete que está abierto, si lo hay. */
  get currentPack(): OpenPack | null {
    return this.openPack;
  }

  /**
   * Una partida lista para reproducir. `null` si esa partida no se deja leer,
   * y entonces el modo TV salta a la siguiente.
   */
  getGame(index: number): ParsedGame | null {
    const pack = this.openPack;
    if (!pack || index < 0 || index >= pack.games.length) {
      return null;
    }
    return buildGame(pack.games[index], pack.headers[index]);
  }

  /** Abre un PGN que trae el usuario (pegado o de un archivo). */
  openUserPgn(pgn: string, title: string): OpenPack | null {
    const { headers, games } = parsePackHeaders(pgn);

    if (headers.length === 0) {
      void this.analytics.logEvent('games_pgn_load_failed', {
        reason: 'no_games',
      });
      return null;
    }

    const pack: OpenPack = {
      collection: {
        id: '',
        name: title,
        reign: '',
        games: headers.length,
        sizeBytes: pgn.length,
        file: '',
      },
      headers,
      games,
    };
    this.openPack = pack;
    return pack;
  }

  // — Ajustes de reproducción ————————————————————————————————

  getSettings(): PlaybackSettings {
    try {
      const json = localStorage.getItem(this.SETTINGS_KEY);
      if (!json) {
        return { ...DEFAULT_PLAYBACK_SETTINGS };
      }
      // Merge con los valores por defecto para tolerar versiones previas
      return { ...DEFAULT_PLAYBACK_SETTINGS, ...JSON.parse(json) };
    } catch (error) {
      console.error('Error al leer los ajustes de reproducción:', error);
      return { ...DEFAULT_PLAYBACK_SETTINGS };
    }
  }

  saveSettings(patch: Partial<PlaybackSettings>): PlaybackSettings {
    const settings = { ...this.getSettings(), ...patch };
    try {
      localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Error al guardar los ajustes de reproducción:', error);
    }
    return settings;
  }

  // — Pantalla encendida ————————————————————————————————————

  /**
   * Mantiene la pantalla encendida mientras el TV reproduce. Se suelta al
   * pausar, al salir y al terminar: dejar la pantalla encendida por descuido
   * es de las cosas que hacen desinstalar una app.
   */
  async keepScreenAwake(keep: boolean): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    try {
      if (keep) {
        await KeepAwake.keepAwake();
      } else {
        await KeepAwake.allowSleep();
      }
    } catch (error) {
      console.warn('[Games] No se pudo cambiar el estado de la pantalla:', error);
    }
  }
}
