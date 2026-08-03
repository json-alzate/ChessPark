import { DEFAULT_CONFIG } from './constants';
import {
  CacheEntry,
  CachedFileIndexEntry,
  InfinityPoolEntry,
  Puzzle,
  StorageSummary,
} from './types';
import { estimateSizeBytes, parsePuzzleUrl } from './utils';

/**
 * Servicio de caché para almacenar puzzles localmente
 * Usa IndexedDB si está disponible, localStorage como fallback
 */
export class PuzzlesCacheService {
  private readonly DB_NAME = 'ChessParkPuzzlesDB';
  private readonly DB_VERSION = 3;
  private readonly STORE_NAME = 'puzzlesCache';
  private readonly INDEX_STORE_NAME = 'puzzlesIndex';
  private readonly POOL_STORE_NAME = 'infinityPool';
  private readonly staleThresholdMs = DEFAULT_CONFIG.CACHE_STALE_THRESHOLD_MS;
  private db: IDBDatabase | null = null;
  private cacheExpirationMs: number;
  private enableCache: boolean;

  constructor(enableCache = true, cacheExpirationMs = 365 * 24 * 60 * 60 * 1000) {
    this.enableCache = enableCache;
    this.cacheExpirationMs = cacheExpirationMs;
    console.log('[PuzzlesCacheService] Constructor - enableCache:', enableCache, 'expiration:', cacheExpirationMs);
  }

  /**
   * Inicializa la base de datos IndexedDB
   */
  async init(): Promise<void> {
    if (!this.enableCache) return;

    if (typeof indexedDB === 'undefined') {
      console.warn('[PuzzlesCacheService] IndexedDB no está disponible, el caché estará deshabilitado');
      this.enableCache = false;
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        console.error('[PuzzlesCacheService] Error al abrir IndexedDB:', request.error);
        this.enableCache = false;
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Crear object store para puzzles cacheados
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'url' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Crear object store para índice de URLs cacheadas
        if (!db.objectStoreNames.contains(this.INDEX_STORE_NAME)) {
          db.createObjectStore(this.INDEX_STORE_NAME, { keyPath: 'key' });
        }

        // Crear object store para el pool de puzzles infinity
        if (!db.objectStoreNames.contains(this.POOL_STORE_NAME)) {
          db.createObjectStore(this.POOL_STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  }

  /**
   * Verifica si un archivo está en caché y no ha expirado
   */
  async isFileCached(url: string): Promise<boolean> {
    if (!this.enableCache || !this.db) return false;

    try {
      const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(url);

      return new Promise((resolve) => {
        request.onsuccess = () => {
          const entry: CacheEntry | undefined = request.result;
          if (!entry) {
            resolve(false);
            return;
          }

          // Verificar si ha expirado
          const now = Date.now();
          const isExpired = now - entry.timestamp > this.cacheExpirationMs;
          
          if (isExpired) {
            this.deleteCachedPuzzles(url).catch(console.error);
            resolve(false);
          } else {
            this.updateLastAccessed(url).catch(console.error);
            resolve(true);
          }
        };

        request.onerror = () => {
          console.error('Error al verificar caché:', request.error);
          resolve(false);
        };
      });
    } catch (error) {
      console.error('Error en isFileCached:', error);
      return false;
    }
  }

  /**
   * Obtiene puzzles cacheados
   */
  async getCachedPuzzles(url: string): Promise<Puzzle[] | null> {
    if (!this.enableCache || !this.db) return null;

    try {
      const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(url);

      return new Promise((resolve) => {
        request.onsuccess = () => {
          const entry: CacheEntry | undefined = request.result;
          if (!entry) {
            resolve(null);
            return;
          }

          // Verificar si ha expirado
          const now = Date.now();
          const isExpired = now - entry.timestamp > this.cacheExpirationMs;
          
          if (isExpired) {
            this.deleteCachedPuzzles(url).catch(console.error);
            resolve(null);
          } else {
            this.updateLastAccessed(url).catch(console.error);
            resolve(entry.puzzles);
          }
        };

        request.onerror = () => {
          console.error('Error al obtener puzzles del caché:', request.error);
          resolve(null);
        };
      });
    } catch (error) {
      console.error('Error en getCachedPuzzles:', error);
      return null;
    }
  }

  /**
   * Cachea puzzles en IndexedDB
   */
  async cachePuzzles(url: string, puzzles: Puzzle[]): Promise<void> {
    if (!this.enableCache || !this.db) return;

    try {
      const now = Date.now();
      const entry: CacheEntry = {
        url,
        puzzles,
        timestamp: now,
        lastAccessedAt: now,
      };

      const transaction = this.db.transaction([this.STORE_NAME, this.INDEX_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const indexStore = transaction.objectStore(this.INDEX_STORE_NAME);

      store.put(entry);

      // Actualizar índice de URLs cacheadas, con la metadata que alimenta la
      // pantalla de gestión de descargas (tema/apertura y ELO salen de la URL)
      const meta = parsePuzzleUrl(url);
      const indexEntry: CachedFileIndexEntry = {
        key: url,
        timestamp: entry.timestamp,
        theme: meta?.theme,
        opening: meta?.opening,
        eloStart: meta?.eloStart,
        eloEnd: meta?.eloEnd,
        count: puzzles.length,
        sizeBytes: estimateSizeBytes(puzzles),
      };
      indexStore.put(indexEntry);

      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => {
          console.error('[PuzzlesCacheService] Error al cachear puzzles:', transaction.error);
          reject(transaction.error);
        };
      });
    } catch (error) {
      console.error('Error en cachePuzzles:', error);
    }
  }

  /**
   * Elimina puzzles cacheados
   */
  async deleteCachedPuzzles(url: string): Promise<void> {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction([this.STORE_NAME, this.INDEX_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const indexStore = transaction.objectStore(this.INDEX_STORE_NAME);

      store.delete(url);
      indexStore.delete(url);

      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (error) {
      console.error('Error en deleteCachedPuzzles:', error);
    }
  }

  /**
   * Limpia todo el caché
   */
  async clearCache(): Promise<void> {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction([this.STORE_NAME, this.INDEX_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const indexStore = transaction.objectStore(this.INDEX_STORE_NAME);

      store.clear();
      indexStore.clear();

      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (error) {
      console.error('Error en clearCache:', error);
    }
  }

  /**
   * Borra varios archivos cacheados en una sola transacción.
   * Pensado para "borrar todos los archivos de un tema".
   */
  async deleteCachedFiles(urls: string[]): Promise<void> {
    if (!this.db || urls.length === 0) return;

    try {
      const transaction = this.db.transaction([this.STORE_NAME, this.INDEX_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const indexStore = transaction.objectStore(this.INDEX_STORE_NAME);

      for (const url of urls) {
        store.delete(url);
        indexStore.delete(url);
      }

      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (error) {
      console.error('[PuzzlesCacheService] Error en deleteCachedFiles:', error);
    }
  }

  /**
   * Lista todos los archivos cacheados con su metadata, para la pantalla de
   * gestión de descargas.
   *
   * Lee solo el índice (pequeño): traer `puzzlesCache` entero para pintar una
   * lista significaría deserializar todos los puzzles. Tema/apertura y ELO se
   * derivan siempre de la URL; `count`/`sizeBytes` faltantes en entradas
   * antiguas se completan una única vez (ver `backfillIndexMetadata`).
   */
  async listCachedFiles(): Promise<CachedFileIndexEntry[]> {
    if (!this.enableCache || !this.db) return [];

    try {
      const entries = await this.getAllIndexEntries();

      const enriched = entries.map((entry) => {
        const meta = parsePuzzleUrl(entry.key);
        return {
          ...entry,
          theme: entry.theme ?? meta?.theme,
          opening: entry.opening ?? meta?.opening,
          eloStart: entry.eloStart ?? meta?.eloStart,
          eloEnd: entry.eloEnd ?? meta?.eloEnd,
        } as CachedFileIndexEntry;
      });

      const pending = enriched.filter(
        (entry) => entry.count === undefined || entry.sizeBytes === undefined
      );

      if (pending.length === 0) return enriched;

      // Si el backfill falla, la lista se muestra igual (sin tamaño) antes que
      // dejar al usuario con una pantalla vacía
      const orphans = await this.backfillIndexMetadata(pending);
      return enriched.filter((entry) => !orphans.has(entry.key));
    } catch (error) {
      console.error('[PuzzlesCacheService] Error en listCachedFiles:', error);
      return [];
    }
  }

  /**
   * Totales agregados del caché: nº de archivos y bytes aproximados.
   */
  async getStorageSummary(): Promise<StorageSummary> {
    const files = await this.listCachedFiles();
    return {
      files: files.length,
      sizeBytes: files.reduce((total, entry) => total + (entry.sizeBytes ?? 0), 0),
    };
  }

  /**
   * Vacía el pool de puzzles de entrenamiento continuo (infinity).
   * Vive en su propio store, así que `clearCache()` no lo toca: se llama
   * aparte desde "borrar todo" para que no quede nada almacenado.
   */
  async clearInfinityPool(): Promise<void> {
    if (!this.db) return;
    if (!this.db.objectStoreNames.contains(this.POOL_STORE_NAME)) return;

    try {
      const transaction = this.db.transaction([this.POOL_STORE_NAME], 'readwrite');
      transaction.objectStore(this.POOL_STORE_NAME).clear();

      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (error) {
      console.error('[PuzzlesCacheService] Error en clearInfinityPool:', error);
    }
  }

  /**
   * Lee el store del índice completo
   */
  private async getAllIndexEntries(): Promise<CachedFileIndexEntry[]> {
    if (!this.db) return [];

    const transaction = this.db.transaction([this.INDEX_STORE_NAME], 'readonly');
    const store = transaction.objectStore(this.INDEX_STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve((request.result ?? []) as CachedFileIndexEntry[]);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Completa `count` y `sizeBytes` de entradas del índice escritas antes de que
   * existiera esa metadata, y persiste el resultado para no repetir el trabajo.
   *
   * Recorre `puzzlesCache` con un único cursor (una sola transacción, sin
   * `await` intermedios que la dejarían expirar) y muta las entradas recibidas.
   * Devuelve las URLs que están en el índice pero no en el caché: entradas
   * huérfanas, que se eliminan del índice y no deben mostrarse.
   */
  private async backfillIndexMetadata(
    entries: CachedFileIndexEntry[]
  ): Promise<Set<string>> {
    const orphans = new Set(entries.map((entry) => entry.key));
    if (!this.db) return orphans;

    const byUrl = new Map(entries.map((entry) => [entry.key, entry]));
    let scanCompleted = false;

    try {
      const readTx = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = readTx.objectStore(this.STORE_NAME);

      await new Promise<void>((resolve, reject) => {
        const cursorReq = store.openCursor();
        cursorReq.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (!cursor) {
            resolve();
            return;
          }

          const cacheEntry: CacheEntry = cursor.value;
          const indexEntry = byUrl.get(cacheEntry.url);
          if (indexEntry) {
            indexEntry.count = cacheEntry.puzzles?.length ?? 0;
            indexEntry.sizeBytes = estimateSizeBytes(cacheEntry.puzzles ?? []);
            orphans.delete(cacheEntry.url);
          }

          cursor.continue();
        };
        cursorReq.onerror = () => reject(cursorReq.error);
      });

      scanCompleted = true;

      const writeTx = this.db.transaction([this.INDEX_STORE_NAME], 'readwrite');
      const indexStore = writeTx.objectStore(this.INDEX_STORE_NAME);
      for (const entry of entries) {
        if (orphans.has(entry.key)) {
          indexStore.delete(entry.key);
        } else {
          indexStore.put(entry);
        }
      }

      await new Promise<void>((resolve, reject) => {
        writeTx.oncomplete = () => resolve();
        writeTx.onerror = () => reject(writeTx.error);
      });
    } catch (error) {
      console.error('[PuzzlesCacheService] Error en backfillIndexMetadata:', error);
      // Sin recorrido completo no se sabe qué falta de verdad: mejor listar
      // los archivos sin tamaño que hacer desaparecer la lista entera
      if (!scanCompleted) return new Set();
    }

    return orphans;
  }

  /**
   * Obtiene el tamaño aproximado del caché
   */
  async getCacheSize(): Promise<number> {
    if (!this.db) return 0;

    try {
      const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.count();

      return new Promise((resolve) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          console.error('Error al obtener tamaño del caché:', request.error);
          resolve(0);
        };
      });
    } catch (error) {
      console.error('Error en getCacheSize:', error);
      return 0;
    }
  }

  /**
   * Actualiza lastAccessedAt de una entrada sin bloquear la lectura
   */
  private async updateLastAccessed(url: string): Promise<void> {
    if (!this.db) return;
    try {
      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(url);
      request.onsuccess = () => {
        const entry: CacheEntry | undefined = request.result;
        if (entry) {
          entry.lastAccessedAt = Date.now();
          store.put(entry);
        }
      };
    } catch (error) {
      console.error('[PuzzlesCacheService] Error en updateLastAccessed:', error);
    }
  }

  /**
   * Elimina entradas no accedidas en más de staleThresholdMs (90 días).
   * Llama esto al inicializar para limpiar archivos de ELOs abandonados.
   * Retorna la cantidad de entradas eliminadas.
   */
  async evictStaleEntries(): Promise<number> {
    if (!this.enableCache || !this.db) return 0;

    const now = Date.now();
    let evicted = 0;

    try {
      const transaction = this.db.transaction([this.STORE_NAME, this.INDEX_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const indexStore = transaction.objectStore(this.INDEX_STORE_NAME);

      return new Promise((resolve) => {
        const cursorReq = store.openCursor();
        cursorReq.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (!cursor) {
            if (evicted > 0) {
              console.log(`[PuzzlesCacheService] evictStaleEntries: ${evicted} entradas eliminadas`);
            }
            resolve(evicted);
            return;
          }

          const entry: CacheEntry = cursor.value;
          const lastAccessed = entry.lastAccessedAt ?? entry.timestamp;

          if (now - lastAccessed > this.staleThresholdMs) {
            cursor.delete();
            indexStore.delete(entry.url);
            evicted++;
          }

          cursor.continue();
        };
        cursorReq.onerror = () => resolve(evicted);
      });
    } catch (error) {
      console.error('[PuzzlesCacheService] Error en evictStaleEntries:', error);
      return 0;
    }
  }

  /**
   * Cierra la conexión a la base de datos
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Obtiene el pool de puzzles infinity almacenado
   */
  async getInfinityPool(): Promise<InfinityPoolEntry | null> {
    if (!this.enableCache || !this.db) return null;
    if (!this.db.objectStoreNames.contains(this.POOL_STORE_NAME)) return null;

    try {
      const transaction = this.db.transaction([this.POOL_STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.POOL_STORE_NAME);
      const request = store.get('infinityPool');

      return new Promise((resolve) => {
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => {
          console.error('[PuzzlesCacheService] Error al obtener infinity pool:', request.error);
          resolve(null);
        };
      });
    } catch (error) {
      console.error('[PuzzlesCacheService] Error en getInfinityPool:', error);
      return null;
    }
  }

  /**
   * Guarda el pool de puzzles infinity
   */
  async saveInfinityPool(entry: InfinityPoolEntry): Promise<void> {
    if (!this.enableCache || !this.db) return;
    if (!this.db.objectStoreNames.contains(this.POOL_STORE_NAME)) return;

    try {
      const transaction = this.db.transaction([this.POOL_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.POOL_STORE_NAME);
      store.put(entry);

      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => {
          console.error('[PuzzlesCacheService] Error al guardar infinity pool:', transaction.error);
          reject(transaction.error);
        };
      });
    } catch (error) {
      console.error('[PuzzlesCacheService] Error en saveInfinityPool:', error);
    }
  }

  /**
   * Retorna URLs del caché cuyo ELO range se solapa con [targetElo - tolerance, targetElo + tolerance]
   */
  async getCachedUrlsMatchingElo(targetElo: number, tolerance = 50): Promise<string[]> {
    if (!this.enableCache || !this.db) return [];

    try {
      const transaction = this.db.transaction([this.INDEX_STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.INDEX_STORE_NAME);

      const allKeys: string[] = await new Promise((resolve, reject) => {
        // getAllKeys está disponible en todos los browsers modernos soportados por Ionic
        if (typeof (store as any).getAllKeys === 'function') {
          const req = (store as any).getAllKeys();
          req.onsuccess = () => resolve(req.result as string[]);
          req.onerror = () => reject(req.error);
        } else {
          // Fallback con cursor
          const keys: string[] = [];
          const cursorReq = store.openCursor();
          cursorReq.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest).result as IDBCursorWithValue;
            if (cursor) {
              keys.push(cursor.key as string);
              cursor.continue();
            } else {
              resolve(keys);
            }
          };
          cursorReq.onerror = () => reject(cursorReq.error);
        }
      });

      const min = targetElo - tolerance;
      const max = targetElo + tolerance;

      return allKeys.filter((url) => {
        const parsed = parsePuzzleUrl(url);
        if (!parsed) return false;
        // El rango [eloStart, eloEnd] se solapa con [min, max]
        return parsed.eloStart <= max && parsed.eloEnd >= min;
      });
    } catch (error) {
      console.error('[PuzzlesCacheService] Error en getCachedUrlsMatchingElo:', error);
      return [];
    }
  }
}

