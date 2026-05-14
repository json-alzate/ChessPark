import { DEFAULT_CONFIG } from './constants';
import { CacheEntry, InfinityPoolEntry, Puzzle } from './types';

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
      
      // Actualizar índice de URLs cacheadas
      indexStore.put({ key: url, timestamp: entry.timestamp });

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

      // Parsear ELO de la URL: patrón _(\d+)_\d+\.json al final del nombre de archivo
      const eloPattern = /_(\d+)_\d+\.json$/;
      return allKeys.filter((url) => {
        const match = url.match(eloPattern);
        if (!match) return false;
        const eloStart = parseInt(match[1], 10);
        const eloEnd = eloStart + 19;
        // El rango [eloStart, eloEnd] se solapa con [min, max]
        return eloStart <= max && eloEnd >= min;
      });
    } catch (error) {
      console.error('[PuzzlesCacheService] Error en getCachedUrlsMatchingElo:', error);
      return [];
    }
  }
}

