import fallbackIndex from './games-index.fallback.json';

import { GAMES_CONFIG } from './constants';
import { GamesCacheService } from './games-cache.service';
import {
  CachedPack,
  GameCollectionInfo,
  GamesIndex,
  GamesProviderConfig,
  GamesStorageSummary,
} from './types';

/** Cuánto lleva descargado un paquete, de 0 a 1. null si no se puede saber. */
export type DownloadProgress = (fraction: number | null) => void;

/**
 * Catálogo de partidas: qué colecciones hay, descargarlas y tenerlas guardadas.
 *
 * El índice se pide al CDN y se guarda en el dispositivo; así, publicar un
 * campeón nuevo es un commit en el repositorio de partidas y no obliga a sacar
 * una versión de la app. Si no hay red ni nada guardado, se usa la copia que
 * viaja dentro de la app para que la pantalla no aparezca vacía.
 */
export class GamesProvider {
  private readonly cdnBaseUrl: string;
  private readonly githubUser: string;
  private readonly repo: string;
  private readonly branch: string;

  private readonly cache = new GamesCacheService();

  /** Índice ya resuelto en esta sesión, para no volver a pedirlo. */
  private memoryIndex: GamesIndex | null = null;

  constructor(config: GamesProviderConfig = {}) {
    this.cdnBaseUrl = config.cdnBaseUrl ?? GAMES_CONFIG.CDN_BASE_URL;
    this.githubUser = config.githubUser ?? GAMES_CONFIG.GITHUB_USER;
    this.repo = config.repo ?? GAMES_CONFIG.REPO;
    this.branch = config.branch ?? GAMES_CONFIG.BRANCH;
  }

  /** Base de todas las URLs del catálogo. */
  private get repoBase(): string {
    return `${this.cdnBaseUrl}/${this.githubUser}/${this.repo}@${this.branch}`;
  }

  /** URL del archivo de una colección. */
  buildPackUrl(collection: GameCollectionInfo): string {
    return `${this.repoBase}/${collection.file}`;
  }

  // — Catálogo ————————————————————————————————————————————————

  /**
   * Las colecciones disponibles. Devuelve lo guardado al instante si aún vale,
   * y solo va a la red cuando toca refrescar (o si se fuerza).
   */
  async getCatalog(options: { forceRefresh?: boolean } = {}): Promise<
    GameCollectionInfo[]
  > {
    if (this.memoryIndex && !options.forceRefresh) {
      return this.memoryIndex.collections;
    }

    const stored = await this.cache.getIndex();
    const isFresh =
      stored !== null &&
      Date.now() - stored.fetchedAt < GAMES_CONFIG.INDEX_TTL_MS;

    if (stored && isFresh && !options.forceRefresh) {
      this.memoryIndex = stored.index;
      return stored.index.collections;
    }

    const fetched = await this.fetchIndex();
    if (fetched) {
      this.memoryIndex = fetched;
      await this.cache.saveIndex(fetched, Date.now());
      return fetched.collections;
    }

    // Sin red: lo guardado aunque esté viejo, y si no la copia de la app.
    const fallback = stored?.index ?? (fallbackIndex as GamesIndex);
    this.memoryIndex = fallback;
    return fallback.collections;
  }

  private async fetchIndex(): Promise<GamesIndex | null> {
    try {
      const response = await fetch(`${this.repoBase}/${GAMES_CONFIG.INDEX_FILE}`);
      if (!response.ok) {
        return null;
      }
      const index = (await response.json()) as GamesIndex;
      return Array.isArray(index?.collections) ? index : null;
    } catch (error) {
      console.warn('[GamesProvider] No se pudo pedir el índice:', error);
      return null;
    }
  }

  /** Una colección concreta del catálogo. */
  async getCollection(id: string): Promise<GameCollectionInfo | null> {
    const collections = await this.getCatalog();
    return collections.find((collection) => collection.id === id) ?? null;
  }

  // — Paquetes ————————————————————————————————————————————————

  /** Ids de los paquetes que ya están en el dispositivo. */
  async getDownloadedIds(): Promise<string[]> {
    const packs = await this.cache.listPacks();
    return packs.map((pack) => pack.id);
  }

  async isDownloaded(id: string): Promise<boolean> {
    return (await this.cache.getPack(id)) !== null;
  }

  /**
   * El PGN de una colección: lo guardado si está, y si no lo descarga.
   * `onProgress` recibe la fracción descargada, o null cuando el servidor no
   * dice cuánto pesa.
   */
  async getPackPgn(
    collection: GameCollectionInfo,
    onProgress?: DownloadProgress
  ): Promise<string> {
    const cached = await this.cache.getPack(collection.id);
    if (cached) {
      return cached.pgn;
    }
    return this.downloadPack(collection, onProgress);
  }

  /** Descarga el paquete y lo guarda. Lanza si no se puede traer. */
  async downloadPack(
    collection: GameCollectionInfo,
    onProgress?: DownloadProgress
  ): Promise<string> {
    const url = this.buildPackUrl(collection);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `No se pudo descargar ${collection.id}: HTTP ${response.status}`
      );
    }

    const pgn = await this.readWithProgress(response, collection, onProgress);

    const pack: CachedPack = {
      id: collection.id,
      pgn,
      sizeBytes: pgn.length,
      downloadedAt: Date.now(),
    };
    await this.cache.savePack(pack);

    return pgn;
  }

  /**
   * Lee el cuerpo avisando del avance. Si el navegador no da acceso al flujo
   * (o no se sabe el tamaño), cae a leerlo de una y avisar con null: la barra
   * se muestra indeterminada en vez de mentir con un porcentaje inventado.
   */
  private async readWithProgress(
    response: Response,
    collection: GameCollectionInfo,
    onProgress?: DownloadProgress
  ): Promise<string> {
    const total =
      Number(response.headers.get('content-length')) || collection.sizeBytes;
    const reader = response.body?.getReader();

    if (!reader || !total) {
      onProgress?.(null);
      const text = await response.text();
      onProgress?.(1);
      return text;
    }

    const chunks: Uint8Array[] = [];
    let received = 0;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      chunks.push(value);
      received += value.length;
      onProgress?.(Math.min(received / total, 1));
    }

    const merged = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    onProgress?.(1);
    return new TextDecoder('utf-8').decode(merged);
  }

  async deletePack(id: string): Promise<void> {
    await this.cache.deletePack(id);
  }

  // — Almacenamiento ————————————————————————————————————————

  async getStorageSummary(): Promise<GamesStorageSummary> {
    return this.cache.getSummary();
  }

  async clearAllPacks(): Promise<void> {
    await this.cache.clearPacks();
  }
}

/** Instancia lista para usar, con la configuración por defecto. */
export function createGamesProvider(
  config?: GamesProviderConfig
): GamesProvider {
  return new GamesProvider(config);
}
