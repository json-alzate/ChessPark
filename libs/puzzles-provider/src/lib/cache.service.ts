import { CacheEntry, Puzzle } from './types';

/**
 * Servicio de caché para almacenar puzzles localmente
 * Usa IndexedDB si está disponible, localStorage como fallback
 */
export class PuzzlesCacheService {
  private readonly DB_NAME = 'ChessParkPuzzlesDB';
  private readonly DB_VERSION = 1;
  private readonly STORE_NAME = 'puzzlesCache';
  private readonly INDEX_STORE_NAME = 'puzzlesIndex';
  private db: IDBDatabase | null = null;
  private cacheExpirationMs: number;
  private enableCache: boolean;

  constructor(enableCache = true, cacheExpirationMs = 7 * 24 * 60 * 60 * 1000) {
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
        console.log('[PuzzlesCacheService] IndexedDB inicializada correctamente:', this.DB_NAME);
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
      };
    });
  }

  /**
   * Verifica si un archivo está en caché y no ha expirado
   */
  async isFileCached(url: string): Promise<boolean> {
    if (!this.enableCache || !this.db) {
      console.log('[PuzzlesCacheService] isFileCached: cache deshabilitado o DB no inicializada');
      return false;
    }

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
            // Eliminar entrada expirada
            console.log('[PuzzlesCacheService] Entrada expirada, eliminando:', url);
            this.deleteCachedPuzzles(url).catch(console.error);
            resolve(false);
          } else {
            console.log('[PuzzlesCacheService] Archivo encontrado en caché:', url);
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
            console.log('[PuzzlesCacheService] Puzzles expirados, eliminando:', url);
            this.deleteCachedPuzzles(url).catch(console.error);
            resolve(null);
          } else {
            console.log('[PuzzlesCacheService] Obteniendo puzzles del caché:', url, 'count:', entry.puzzles.length);
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
    if (!this.enableCache || !this.db) {
      console.log('[PuzzlesCacheService] cachePuzzles: cache deshabilitado o DB no inicializada');
      return;
    }

    try {
      const entry: CacheEntry = {
        url,
        puzzles,
        timestamp: Date.now(),
      };

      const transaction = this.db.transaction([this.STORE_NAME, this.INDEX_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const indexStore = transaction.objectStore(this.INDEX_STORE_NAME);

      store.put(entry);
      
      // Actualizar índice de URLs cacheadas
      indexStore.put({ key: url, timestamp: entry.timestamp });

      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => {
          console.log('[PuzzlesCacheService] Puzzles cacheados exitosamente:', url, 'count:', puzzles.length);
          resolve();
        };
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
   * Cierra la conexión a la base de datos
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

