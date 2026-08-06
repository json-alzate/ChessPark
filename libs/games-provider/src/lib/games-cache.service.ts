import { CachedPack, GamesIndex, GamesStorageSummary } from './types';

/**
 * Guarda en el dispositivo los paquetes de partidas y el índice del catálogo.
 *
 * Va en su propia base de IndexedDB, separada de la de puzzles: son contenidos
 * independientes y así añadir esto no obliga a subir la versión del esquema de
 * aquella ni arriesga sus datos.
 *
 * Un paquete son entre 1 y 3 MB de texto, así que localStorage no es una
 * opción. Sin IndexedDB, la pantalla sigue funcionando pero sin guardar nada:
 * cada visita vuelve a descargar.
 */
export class GamesCacheService {
  private readonly DB_NAME = 'ChessColateGamesDB';
  private readonly DB_VERSION = 1;
  private readonly PACKS_STORE = 'packs';
  private readonly META_STORE = 'meta';
  private readonly INDEX_KEY = 'catalogIndex';

  private db: IDBDatabase | null = null;
  private available = true;

  /** true si se puede guardar en el dispositivo. */
  get isAvailable(): boolean {
    return this.available;
  }

  async init(): Promise<void> {
    if (this.db || !this.available) {
      return;
    }
    if (typeof indexedDB === 'undefined') {
      console.warn('[GamesCache] IndexedDB no disponible: no se guardará nada');
      this.available = false;
      return;
    }

    try {
      this.db = await this.open();
    } catch (error) {
      console.warn('[GamesCache] No se pudo abrir la base de datos:', error);
      this.available = false;
    }
  }

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.PACKS_STORE)) {
          db.createObjectStore(this.PACKS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(this.META_STORE)) {
          db.createObjectStore(this.META_STORE, { keyPath: 'key' });
        }
      };
    });
  }

  // — Paquetes ————————————————————————————————————————————————

  async getPack(id: string): Promise<CachedPack | null> {
    return this.read<CachedPack>(this.PACKS_STORE, id);
  }

  async savePack(pack: CachedPack): Promise<void> {
    await this.write(this.PACKS_STORE, pack);
  }

  async deletePack(id: string): Promise<void> {
    await this.remove(this.PACKS_STORE, id);
  }

  /** Los paquetes guardados, sin traerse su texto: solo id y tamaño. */
  async listPacks(): Promise<Array<Omit<CachedPack, 'pgn'>>> {
    const packs = await this.readAll<CachedPack>(this.PACKS_STORE);
    return packs.map(({ id, sizeBytes, downloadedAt }) => ({
      id,
      sizeBytes,
      downloadedAt,
    }));
  }

  async getSummary(): Promise<GamesStorageSummary> {
    const packs = await this.listPacks();
    return {
      packs: packs.length,
      sizeBytes: packs.reduce((total, pack) => total + (pack.sizeBytes || 0), 0),
    };
  }

  async clearPacks(): Promise<void> {
    await this.clear(this.PACKS_STORE);
  }

  // — Índice del catálogo ————————————————————————————————————

  async getIndex(): Promise<{ index: GamesIndex; fetchedAt: number } | null> {
    const stored = await this.read<{
      key: string;
      index: GamesIndex;
      fetchedAt: number;
    }>(this.META_STORE, this.INDEX_KEY);

    return stored ? { index: stored.index, fetchedAt: stored.fetchedAt } : null;
  }

  async saveIndex(index: GamesIndex, fetchedAt: number): Promise<void> {
    await this.write(this.META_STORE, { key: this.INDEX_KEY, index, fetchedAt });
  }

  // — Envoltorios de IndexedDB ————————————————————————————————
  //
  // Todos son defensivos: guardar partidas es una comodidad, no puede tumbar
  // la pantalla si el navegador se pone tonto.

  private async read<T>(store: string, key: string): Promise<T | null> {
    await this.init();
    const db = this.db;
    if (!db) {
      return null;
    }

    return new Promise((resolve) => {
      try {
        const request = db
          .transaction(store, 'readonly')
          .objectStore(store)
          .get(key);
        request.onsuccess = () => resolve((request.result as T) ?? null);
        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  private async readAll<T>(store: string): Promise<T[]> {
    await this.init();
    const db = this.db;
    if (!db) {
      return [];
    }

    return new Promise((resolve) => {
      try {
        const request = db
          .transaction(store, 'readonly')
          .objectStore(store)
          .getAll();
        request.onsuccess = () => resolve((request.result as T[]) ?? []);
        request.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }

  private async write(store: string, value: unknown): Promise<void> {
    await this.init();
    const db = this.db;
    if (!db) {
      return;
    }

    return new Promise((resolve) => {
      try {
        const request = db
          .transaction(store, 'readwrite')
          .objectStore(store)
          .put(value);
        request.onsuccess = () => resolve();
        request.onerror = () => {
          console.warn('[GamesCache] No se pudo guardar en', store, request.error);
          resolve();
        };
      } catch (error) {
        console.warn('[GamesCache] Error escribiendo en', store, error);
        resolve();
      }
    });
  }

  private async remove(store: string, key: string): Promise<void> {
    await this.init();
    const db = this.db;
    if (!db) {
      return;
    }

    return new Promise((resolve) => {
      try {
        const request = db
          .transaction(store, 'readwrite')
          .objectStore(store)
          .delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  private async clear(store: string): Promise<void> {
    await this.init();
    const db = this.db;
    if (!db) {
      return;
    }

    return new Promise((resolve) => {
      try {
        const request = db
          .transaction(store, 'readwrite')
          .objectStore(store)
          .clear();
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
}
