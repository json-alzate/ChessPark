import { PuzzlesCacheService } from './cache.service';
import { DEFAULT_CONFIG } from './constants';
import { getManifestThemes, getValidEloStarts } from './manifest';
import { Puzzle, PuzzleQueryOptions, PuzzlesProviderConfig } from './types';
import {
  buildPuzzleUrl,
  filterByColor,
  filterEloSequenceByManifest,
  generateEloSequence,
  generateEloSequenceInRange,
  limitPuzzleCount,
  normalizeElo,
  shuffleArray,
} from './utils';

/** Un archivo que no respondió a tiempo. */
class TimeoutError extends Error {
  constructor(url: string, ms: number) {
    super(`Tiempo de espera agotado (${ms} ms) al descargar ${url}`);
    this.name = 'TimeoutError';
  }
}

/**
 * Proveedor principal para obtener puzzles de ajedrez
 * Maneja la lógica de caché, obtención desde CDN y búsqueda inteligente por ELO
 */
export class PuzzlesProvider {
  private cacheService: PuzzlesCacheService;
  private config: Required<PuzzlesProviderConfig>;
  private downloadQueue: Promise<unknown>[] = [];

  constructor(config?: PuzzlesProviderConfig) {
    this.config = {
      cdnBaseUrl: config?.cdnBaseUrl ?? DEFAULT_CONFIG.CDN_BASE_URL,
      githubUser: config?.githubUser ?? DEFAULT_CONFIG.GITHUB_USER,
      enableCache: config?.enableCache ?? DEFAULT_CONFIG.ENABLE_CACHE,
      cacheExpirationMs: config?.cacheExpirationMs ?? DEFAULT_CONFIG.CACHE_EXPIRATION_MS,
      maxConcurrentDownloads: config?.maxConcurrentDownloads ?? DEFAULT_CONFIG.MAX_CONCURRENT_DOWNLOADS,
      batchSize: config?.batchSize ?? DEFAULT_CONFIG.BATCH_SIZE,
      requestTimeoutMs: config?.requestTimeoutMs ?? DEFAULT_CONFIG.REQUEST_TIMEOUT_MS,
    };

    this.cacheService = new PuzzlesCacheService(
      this.config.enableCache,
      this.config.cacheExpirationMs
    );
  }

  /**
   * Inicializa el proveedor (debe llamarse antes de usar getPuzzles)
   */
  async init(): Promise<void> {
    await this.cacheService.init();
    this.cacheService.evictStaleEntries().catch(console.warn);
  }

  /**
   * Obtiene puzzles según los criterios especificados
   * 
   * @param options - Opciones de consulta
   * @returns Array de puzzles que cumplen los criterios
   * 
   * @example
   * ```typescript
   * const provider = new PuzzlesProvider();
   * await provider.init();
   * 
   * // Obtener 200 puzzles de nivel 1500
   * const puzzles = await provider.getPuzzles({ elo: 1500 });
   * 
   * // Obtener puzzles de un tema específico
   * const themePuzzles = await provider.getPuzzles({ 
   *   elo: 1800, 
   *   theme: 'fork',
   *   count: 100 
   * });
   * 
   * // Obtener puzzles de una apertura
   * const openingPuzzles = await provider.getPuzzles({ 
   *   elo: 1600, 
   *   openingFamily: 'Sicilian_Defense' 
   * });
   * ```
   */
  async getPuzzles(options: PuzzleQueryOptions): Promise<Puzzle[]> {
    const count = limitPuzzleCount(options.count);
    const color = options.color ?? 'N/A';

    // Si no se especifica tema ni apertura, elegir un tema aleatorio
    let theme = options.theme;
    const openingFamily = options.openingFamily;

    if (!theme && !openingFamily) {
      theme = this.getRandomTheme();
    }

    // Generar secuencia de ELOs: rango fijo si se especifica, o expansión desde un punto central
    let eloSequence: number[];
    if (options.eloMin !== undefined && options.eloMax !== undefined) {
      eloSequence = generateEloSequenceInRange(options.eloMin, options.eloMax);
    } else {
      const elo = normalizeElo(options.elo);
      eloSequence = generateEloSequence(elo);
    }

    // Filtrar la secuencia contra el manifiesto: solo se piden URLs que existen.
    // Si la combinación tema/apertura no está en el manifiesto, no hay nada que pedir.
    const validStarts = getValidEloStarts(theme, openingFamily);
    eloSequence = filterEloSequenceByManifest(eloSequence, validStarts);
    if (eloSequence.length === 0) {
      return [];
    }

    let allPuzzles: Puzzle[] = [];

    // Procesar ELOs en batches paralelos para mejorar el rendimiento
    for (let i = 0; i < eloSequence.length && allPuzzles.length < count; i += this.config.batchSize) {
      const batch = eloSequence.slice(i, i + this.config.batchSize);

      // Descargar el batch en paralelo con control de concurrencia
      let failedInBatch = 0;
      const batchPromises = batch.map(currentElo =>
        this.fetchWithConcurrencyLimit(() =>
          this.fetchPuzzlesByElo(currentElo, theme, openingFamily)
            .catch((error) => {
              failedInBatch++;
              console.warn(`Error al obtener puzzles para ELO ${currentElo}:`, error);
              return [] as Puzzle[];
            })
        )
      );

      const batchResults = await Promise.all(batchPromises);
      const batchPuzzles = batchResults.flat();

      if (batchPuzzles.length > 0) {
        allPuzzles = allPuzzles.concat(batchPuzzles);
      }

      // Si todo un batch falló por error (no por archivos que no existen) y aún no hay nada, el CDN
      // no está respondiendo: seguir con los ELOs vecinos solo suma esperas de varios segundos cada una.
      // Quien llama decide si prueba otro tema.
      if (allPuzzles.length === 0 && failedInBatch === batch.length) break;

      // Si ya tenemos suficientes puzzles, detener la búsqueda
      if (allPuzzles.length >= count) break;
    }

    // Un mismo ejercicio no debe salir dos veces en la lista (archivos vecinos con contenido repetido)
    allPuzzles = this.withoutRepeated(allPuzzles);

    // Filtrar por color si se especificó
    if (color !== 'N/A') {
      allPuzzles = filterByColor(allPuzzles, color);
    }

    // Mezclar y limitar a la cantidad solicitada
    const shuffled = shuffleArray(allPuzzles);
    return shuffled.slice(0, count);
  }

  /** Conserva la primera aparición de cada `uid`; los ejercicios sin `uid` no se comparan entre sí. */
  private withoutRepeated(puzzles: Puzzle[]): Puzzle[] {
    const seen = new Set<string>();
    return puzzles.filter((puzzle) => {
      if (!puzzle.uid) {
        return true;
      }
      if (seen.has(puzzle.uid)) {
        return false;
      }
      seen.add(puzzle.uid);
      return true;
    });
  }

  /**
   * Controla el número de descargas concurrentes usando un semáforo
   * @param task - Función que realiza la descarga
   * @returns Resultado de la tarea
   */
  private async fetchWithConcurrencyLimit<T>(task: () => Promise<T>): Promise<T> {
    // Esperar si hay demasiadas descargas en curso
    while (this.downloadQueue.length >= this.config.maxConcurrentDownloads) {
      await Promise.race(this.downloadQueue);
    }

    const downloadPromise = task().finally(() => {
      const index = this.downloadQueue.indexOf(downloadPromise);
      if (index > -1) {
        this.downloadQueue.splice(index, 1);
      }
    });

    this.downloadQueue.push(downloadPromise);
    return downloadPromise;
  }

  /**
   * Obtiene puzzles para un ELO específico
   * Intenta primero desde caché, si no está disponible, descarga desde CDN
   */
  private async fetchPuzzlesByElo(
    elo: number,
    theme?: string,
    openingFamily?: string
  ): Promise<Puzzle[]> {
    const url = buildPuzzleUrl(
      this.config.cdnBaseUrl,
      this.config.githubUser,
      elo,
      theme,
      openingFamily
    );

    // Intentar obtener desde caché primero (no requiere control de concurrencia)
    if (this.config.enableCache) {
      const cached = await this.cacheService.getCachedPuzzles(url);
      if (cached && cached.length > 0) {
        return cached;
      }
    }

    // Si no está en caché, descargar desde CDN (con control de concurrencia)
    const puzzles = await this.fetchFromCDN(url);

    // Cachear para uso futuro (no bloquear)
    if (this.config.enableCache && puzzles.length > 0) {
      this.cacheService.cachePuzzles(url, puzzles).catch((error) => {
        console.warn('Error al cachear puzzles:', error);
      });
    }

    return puzzles;
  }

  /**
   * Descarga puzzles desde el CDN.
   *
   * Cada intento tiene un tiempo máximo (`requestTimeoutMs`) y un archivo que no responde se reintenta
   * una vez antes de rendirse: una descarga colgada no puede dejar la pantalla esperando para siempre ni
   * ocupar una de las plazas de descarga simultánea.
   */
  private async fetchFromCDN(url: string): Promise<Puzzle[]> {
    const ATTEMPTS = 2;
    let lastError: unknown;

    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      try {
        return await this.fetchOnce(url);
      } catch (error) {
        lastError = error;
        // Un error de servidor (distinto de 404/403, que ya devuelven vacío) no mejora al reintentar
        // inmediatamente, pero un corte de red o un tiempo agotado sí puede
        if (!(error instanceof TimeoutError) && !(error instanceof TypeError)) {
          break;
        }
      }
    }

    if (lastError instanceof TypeError && lastError.message.includes('fetch')) {
      throw new Error('Error de red al obtener puzzles. Verifica tu conexión.');
    }
    throw lastError;
  }

  /** Un intento de descarga, con su tiempo máximo. */
  private async fetchOnce(url: string): Promise<Puzzle[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal });

      if (!response.ok) {
        if (response.status === 404 || response.status === 403) {
          return [];
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const rawPuzzles = await response.json();
      const puzzles = Array.isArray(rawPuzzles) ? rawPuzzles : [];

      // Convertir los puzzles del CDN al formato completo esperado
      return puzzles.map((puzzle: any) => this.enrichPuzzle(puzzle));
    } catch (error) {
      if (controller.signal.aborted) {
        throw new TimeoutError(url, this.config.requestTimeoutMs);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Enriquece un puzzle con las propiedades faltantes
   */
  private enrichPuzzle(rawPuzzle: any): Puzzle {
    return {
      uid: rawPuzzle.uid || '',
      fen: rawPuzzle.fen || '',
      moves: rawPuzzle.moves || '',
      rating: rawPuzzle.rating || 1500,
      ratingDeviation: rawPuzzle.ratingDeviation || 0,
      popularity: rawPuzzle.popularity || 0,
      randomNumberQuery: Math.random(),
      nbPlays: rawPuzzle.nbPlays || 0,
      themes: rawPuzzle.themes || [],
      gameUrl: rawPuzzle.gameUrl || '',
      openingFamily: rawPuzzle.openingFamily || '',
      openingVariation: rawPuzzle.openingVariation || '',
      times: rawPuzzle.times,
      timeUsed: rawPuzzle.timeUsed,
      goshPuzzleTime: rawPuzzle.goshPuzzleTime,
      fenStartUserPuzzle: rawPuzzle.fenStartUserPuzzle,
      firstMoveSquaresHighlight: rawPuzzle.firstMoveSquaresHighlight
    };
  }

  /**
   * Obtiene un tema aleatorio de la lista de temas con archivos reales disponibles
   * (claves del manifiesto), para no caer nunca en un tema sin puzzles.
   */
  private getRandomTheme(): string {
    const themes = getManifestThemes();
    const randomIndex = Math.floor(Math.random() * themes.length);
    return themes[randomIndex];
  }

  /**
   * Expone la instancia ya inicializada de PuzzlesCacheService
   */
  getCacheService(): PuzzlesCacheService {
    return this.cacheService;
  }

  /**
   * Limpia todo el caché de puzzles
   */
  async clearCache(): Promise<void> {
    await this.cacheService.clearCache();
  }

  /**
   * Obtiene el tamaño actual del caché
   */
  async getCacheSize(): Promise<number> {
    return await this.cacheService.getCacheSize();
  }

  /**
   * Cierra la conexión del caché
   * Debe llamarse cuando ya no se vaya a usar el proveedor
   */
  close(): void {
    this.cacheService.close();
  }

  /**
   * Obtiene la configuración actual del proveedor
   */
  getConfig(): Readonly<Required<PuzzlesProviderConfig>> {
    return { ...this.config };
  }
}

/**
 * Función helper para crear y inicializar rápidamente un proveedor
 */
export async function createPuzzlesProvider(
  config?: PuzzlesProviderConfig
): Promise<PuzzlesProvider> {
  const provider = new PuzzlesProvider(config);
  await provider.init();
  return provider;
}
