import { ChessPlatform } from '@cpark/models';

import {
  AccountStorageSummary,
  ArchiveStorageSummary,
  CachedArchiveMonth,
} from './types';

/**
 * Guarda en el dispositivo los meses de partidas ya descargados.
 *
 * Va en su propia base de IndexedDB, separada de la de puzzles y la del
 * catálogo de partidas: son contenidos independientes y así añadir esto no
 * obliga a tocar el esquema de aquellas ni arriesga sus datos.
 *
 * IndexedDB y no localStorage: un año de partidas en PGN pasa de los cinco
 * megas que aguanta localStorage, y quedarse sin espacio a mitad de una
 * descarga es la peor manera de enterarse.
 */
export class ArchiveCacheService {
  private readonly DB_NAME = 'ChessColateArchiveDB';
  private readonly DB_VERSION = 1;
  private readonly MONTHS_STORE = 'months';

  private db: IDBDatabase | null = null;
  private available = true;

  /** true si se puede guardar en el dispositivo. */
  get isAvailable(): boolean {
    return this.available;
  }

  /** La clave con la que se guarda un mes de una cuenta. */
  static buildKey(
    platform: ChessPlatform,
    username: string,
    monthKey: string
  ): string {
    return `${platform}:${username.toLowerCase()}:${monthKey}`;
  }

  async init(): Promise<void> {
    if (this.db || !this.available) {
      return;
    }
    if (typeof indexedDB === 'undefined') {
      console.warn('[ArchiveCache] IndexedDB no disponible: no se guardará nada');
      this.available = false;
      return;
    }

    try {
      this.db = await this.open();
    } catch (error) {
      console.warn('[ArchiveCache] No se pudo abrir la base de datos:', error);
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
        if (!db.objectStoreNames.contains(this.MONTHS_STORE)) {
          db.createObjectStore(this.MONTHS_STORE, { keyPath: 'key' });
        }
      };
    });
  }

  // — Meses ————————————————————————————————————————————————————

  async getMonth(
    platform: ChessPlatform,
    username: string,
    monthKey: string
  ): Promise<CachedArchiveMonth | null> {
    return this.read<CachedArchiveMonth>(
      ArchiveCacheService.buildKey(platform, username, monthKey)
    );
  }

  async saveMonth(month: CachedArchiveMonth): Promise<void> {
    await this.write(month);
  }

  /** Todos los meses guardados de una cuenta, del más antiguo al más nuevo. */
  async listMonths(
    platform: ChessPlatform,
    username: string
  ): Promise<CachedArchiveMonth[]> {
    const prefix = `${platform}:${username.toLowerCase()}:`;
    const all = await this.readAll();
    return all
      .filter((month) => month.key.startsWith(prefix))
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }

  /** Borra todo lo guardado de una cuenta. */
  async deleteAccount(
    platform: ChessPlatform,
    username: string
  ): Promise<void> {
    const months = await this.listMonths(platform, username);
    for (const month of months) {
      await this.remove(month.key);
    }
  }

  async clearAll(): Promise<void> {
    await this.clear();
  }

  // — Almacenamiento ————————————————————————————————————————

  async getSummary(): Promise<ArchiveStorageSummary> {
    const months = await this.readAll();
    return {
      months: months.length,
      games: months.reduce((total, month) => total + month.games.length, 0),
      sizeBytes: months.reduce((total, month) => total + (month.sizeBytes || 0), 0),
    };
  }

  /** Lo guardado agrupado por cuenta, para poder borrarlo cuenta a cuenta. */
  async getSummaryByAccount(): Promise<AccountStorageSummary[]> {
    const months = await this.readAll();
    const byAccount = new Map<string, AccountStorageSummary>();

    for (const month of months) {
      const id = `${month.platform}:${month.username}`;
      const current = byAccount.get(id) ?? {
        platform: month.platform,
        username: month.username,
        months: 0,
        games: 0,
        sizeBytes: 0,
      };

      current.months += 1;
      current.games += month.games.length;
      current.sizeBytes += month.sizeBytes || 0;
      byAccount.set(id, current);
    }

    return [...byAccount.values()].sort((a, b) => b.sizeBytes - a.sizeBytes);
  }

  // — Envoltorios de IndexedDB ————————————————————————————————
  //
  // Todos son defensivos: guardar partidas es una comodidad, no puede tumbar
  // la pantalla si el navegador se pone tonto.

  private async read<T>(key: string): Promise<T | null> {
    await this.init();
    const db = this.db;
    if (!db) {
      return null;
    }

    return new Promise((resolve) => {
      try {
        const request = db
          .transaction(this.MONTHS_STORE, 'readonly')
          .objectStore(this.MONTHS_STORE)
          .get(key);
        request.onsuccess = () => resolve((request.result as T) ?? null);
        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  private async readAll(): Promise<CachedArchiveMonth[]> {
    await this.init();
    const db = this.db;
    if (!db) {
      return [];
    }

    return new Promise((resolve) => {
      try {
        const request = db
          .transaction(this.MONTHS_STORE, 'readonly')
          .objectStore(this.MONTHS_STORE)
          .getAll();
        request.onsuccess = () =>
          resolve((request.result as CachedArchiveMonth[]) ?? []);
        request.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }

  private async write(value: CachedArchiveMonth): Promise<void> {
    await this.init();
    const db = this.db;
    if (!db) {
      return;
    }

    return new Promise((resolve) => {
      try {
        const request = db
          .transaction(this.MONTHS_STORE, 'readwrite')
          .objectStore(this.MONTHS_STORE)
          .put(value);
        request.onsuccess = () => resolve();
        request.onerror = () => {
          console.warn('[ArchiveCache] No se pudo guardar', value.key, request.error);
          resolve();
        };
      } catch (error) {
        console.warn('[ArchiveCache] Error escribiendo', value.key, error);
        resolve();
      }
    });
  }

  private async remove(key: string): Promise<void> {
    await this.init();
    const db = this.db;
    if (!db) {
      return;
    }

    return new Promise((resolve) => {
      try {
        const request = db
          .transaction(this.MONTHS_STORE, 'readwrite')
          .objectStore(this.MONTHS_STORE)
          .delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  private async clear(): Promise<void> {
    await this.init();
    const db = this.db;
    if (!db) {
      return;
    }

    return new Promise((resolve) => {
      try {
        const request = db
          .transaction(this.MONTHS_STORE, 'readwrite')
          .objectStore(this.MONTHS_STORE)
          .clear();
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
}
