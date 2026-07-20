import { Injectable } from '@angular/core';

import {
  AVAILABLE_THEMES,
  InfinityPoolEntry,
  Puzzle,
  PuzzlesProvider,
  dedupeByUid,
  shuffleArray,
} from '@chesspark/puzzles-provider';
import { ProfileService } from '@services/profile.service';

@Injectable({
  providedIn: 'root',
})
export class InfinityPuzzlePoolService {
  private readonly POOL_SIZE = 50;
  private readonly PUZZLES_PER_THEME = 5;
  private readonly REFILL_THRESHOLD = 15;

  /**
   * Deriva de elo a partir de la cual conviene reconstruir el pool al elo actual,
   * SIN dejar de servirlo mientras llega el nuevo.
   * Es ~1σ de la deriva que el propio pool experimenta a lo largo de sus 50
   * puzzles (16 pts/puzzle × √50 ≈ 113): por debajo de eso, invalidar garantiza
   * tirar el pool antes de consumirlo.
   */
  private readonly ELO_REFRESH_TOLERANCE = 100;

  /**
   * Deriva a partir de la cual los puzzles son de una dificultad genuinamente
   * equivocada y es preferible no servirlos. 400 = razón de expectativa 10:1 de
   * la escala Elo (un puzzle 400 por debajo se resuelve ~91% de las veces).
   * En la práctica casi nunca se alcanza: la reconstrucción en background llega
   * mucho antes. Existe para el caso "retomo la app tras meses".
   */
  private readonly ELO_MAX_TOLERANCE = 400;

  private isRefilling = false;
  private buildInFlight: Promise<void> | null = null;

  /**
   * Serializa los read-modify-write sobre el pool. IndexedDB no ofrece una
   * transacción que abarque el await entre getInfinityPool() y
   * saveInfinityPool(), así que la exclusión mutua tiene que vivir aquí: sin
   * ella dos pops concurrentes leen el mismo pool y sirven el mismo puzzle.
   */
  private poolChain: Promise<unknown> = Promise.resolve();

  constructor(
    private puzzlesProvider: PuzzlesProvider,
    private profileService: ProfileService
  ) {}

  private get cacheService() {
    return this.puzzlesProvider.getCacheService();
  }

  private withPoolLock<T>(task: () => Promise<T>): Promise<T> {
    // .then(task, task) hace que un predecesor rechazado no bloquee al siguiente.
    const run = this.poolChain.then(task, task);
    // La cadena nunca se rechaza: un fallo no debe envenenar a los que esperan.
    this.poolChain = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  getUserInfinityElo(): number {
    return this.profileService.getEloTotalByPlanType('infinity');
  }

  async getPool(): Promise<InfinityPoolEntry | null> {
    return this.cacheService.getInfinityPool();
  }

  isPoolValid(pool: InfinityPoolEntry, userElo: number): boolean {
    return (
      pool.puzzles.length > 0 &&
      Math.abs(pool.elo - userElo) <= this.ELO_MAX_TOLERANCE
    );
  }

  /** El pool sigue sirviendo, pero conviene reconstruirlo al elo actual. */
  private needsRefresh(pool: InfinityPoolEntry, userElo: number): boolean {
    return Math.abs(pool.elo - userElo) > this.ELO_REFRESH_TOLERANCE;
  }

  /**
   * Única fuente de puzzles para la sesión de entrenamiento continuo.
   * Sirve del pool; si el pool no puede servir, agenda su reconstrucción y
   * entrega UN puzzle del caché de archivos o del CDN. Nunca precarga un lote:
   * así el pool se vuelve a consultar en el siguiente puzzle y la sesión no
   * queda encerrada en un único tema.
   */
  async getNextPuzzle(): Promise<Puzzle | null> {
    const fromPool = await this.popOnePuzzle();
    if (fromPool) return fromPool;

    const elo = this.getUserInfinityElo();
    this.refillPoolBackground(elo);
    return this.fetchOnePuzzleOutsidePool(elo);
  }

  private async fetchOnePuzzleOutsidePool(elo: number): Promise<Puzzle | null> {
    const cached = await this.findPuzzleFromCachedFiles(elo);
    if (cached) return cached;

    const puzzles = await this.puzzlesProvider.getPuzzles({ elo });
    return puzzles?.[0] ?? null;
  }

  /** Lee un puzzle aleatorio del pool sin removerlo (para preview en el home) */
  async peekOnePuzzle(): Promise<Puzzle | null> {
    const userElo = this.getUserInfinityElo();
    const pool = await this.getPool();
    if (!pool || !this.isPoolValid(pool, userElo) || pool.puzzles.length === 0)
      return null;
    const idx = Math.floor(Math.random() * pool.puzzles.length);
    return pool.puzzles[idx];
  }

  /** Elimina un puzzle específico del pool por uid (tras interactuar con él en el home) */
  async removePuzzleFromPool(uid: string): Promise<void> {
    const userElo = this.getUserInfinityElo();

    await this.withPoolLock(async () => {
      const pool = await this.getPool();
      if (!pool || !this.isPoolValid(pool, userElo)) return;

      const remaining = pool.puzzles.filter((p) => p.uid !== uid);
      await this.cacheService.saveInfinityPool({ ...pool, puzzles: remaining });

      if (remaining.length <= this.REFILL_THRESHOLD) {
        this.refillPoolBackground(userElo);
      }
    });
  }

  async popOnePuzzle(): Promise<Puzzle | null> {
    const userElo = this.getUserInfinityElo();

    return this.withPoolLock(async () => {
      const pool = await this.getPool();

      if (!pool || !this.isPoolValid(pool, userElo)) {
        // Agendar la reconstrucción: antes se devolvía null sin más y el pool
        // quedaba muerto el resto de la sesión.
        this.refillPoolBackground(userElo);
        return null;
      }

      const [puzzle, ...remaining] = pool.puzzles;
      await this.cacheService.saveInfinityPool({ ...pool, puzzles: remaining });

      if (
        remaining.length <= this.REFILL_THRESHOLD ||
        this.needsRefresh(pool, userElo)
      ) {
        this.refillPoolBackground(userElo);
      }

      return puzzle ?? null;
    });
  }

  async buildPool(elo: number): Promise<void> {
    // Coalescer: el home puede disparar dos buildPool concurrentes (casos 2 y 3).
    // Esperar al que ya corre es mejor que descartar la petición o construir dos veces.
    if (this.buildInFlight) return this.buildInFlight;

    this.buildInFlight = this.doBuildPool(elo).finally(() => {
      this.buildInFlight = null;
    });
    return this.buildInFlight;
  }

  private async doBuildPool(elo: number): Promise<void> {
    const existing = await this.getPool();
    if (
      existing &&
      this.isPoolValid(existing, elo) &&
      !this.needsRefresh(existing, elo)
    ) {
      return;
    }

    const themes = this.pickRandomThemes(10);
    const batches = await Promise.all(
      themes.map((t) =>
        this.puzzlesProvider
          .getPuzzles({ elo, theme: t, count: this.PUZZLES_PER_THEME })
          .catch(() => [] as Puzzle[])
      )
    );
    const fresh = dedupeByUid(shuffleArray(batches.flat()));

    await this.withPoolLock(async () => {
      const current = await this.getPool();
      // Conservar sólo lo que quede del pool al MISMO elo. Antes se hacía un put
      // ciego que revertía los pops ocurridos durante la construcción y devolvía
      // al pool puzzles ya servidos.
      const keep = current && current.elo === elo ? current.puzzles : [];
      const puzzles = dedupeByUid([...keep, ...fresh]).slice(0, this.POOL_SIZE);

      await this.cacheService.saveInfinityPool({
        id: 'infinityPool',
        puzzles,
        elo,
        createdAt: Date.now(),
      });
    });
  }

  refillPoolBackground(elo: number): void {
    if (this.isRefilling) return;
    this.isRefilling = true;

    (async () => {
      try {
        const pool = await this.getPool();

        if (!pool || !this.isPoolValid(pool, elo) || this.needsRefresh(pool, elo)) {
          await this.buildPool(elo);
          return;
        }

        const needed = this.POOL_SIZE - pool.puzzles.length;
        if (needed <= 0) return;

        const themeCount = new Map<string, number>();
        for (const puzzle of pool.puzzles) {
          for (const theme of puzzle.themes) {
            themeCount.set(theme, (themeCount.get(theme) ?? 0) + 1);
          }
        }

        // Temas con espacio disponible (menos de PUZZLES_PER_THEME en el pool actual)
        const available = AVAILABLE_THEMES.filter(
          (t) => (themeCount.get(t) ?? 0) < this.PUZZLES_PER_THEME
        );
        const themesToFetch = this.pickRandomThemesFrom(
          available,
          Math.ceil(needed / this.PUZZLES_PER_THEME)
        );

        const results = await Promise.all(
          themesToFetch.map((t) => {
            const canFetch = this.PUZZLES_PER_THEME - (themeCount.get(t) ?? 0);
            return this.puzzlesProvider
              .getPuzzles({ elo, theme: t, count: canFetch })
              .catch(() => [] as Puzzle[]);
          })
        );

        const newPuzzles = results.flat();

        // Los fetches al CDN quedan fuera del lock: sostenerlo durante segundos
        // de red congelaría cada pop del entrenamiento.
        await this.withPoolLock(async () => {
          // Re-leer bajo el lock: pudo haber pops mientras se descargaba.
          const current = await this.getPool();
          const base = current?.puzzles ?? [];
          const merged = dedupeByUid(
            shuffleArray([...base, ...newPuzzles])
          ).slice(0, this.POOL_SIZE);

          // Re-anclar el elo. Antes el spread {...pool} conservaba el elo viejo,
          // así que rellenar nunca podía devolverle la validez al pool.
          await this.cacheService.saveInfinityPool({
            id: 'infinityPool',
            puzzles: merged,
            elo,
            createdAt: Date.now(),
          });
        });
      } catch (err) {
        console.error(
          '[InfinityPuzzlePoolService] Error en refillPoolBackground:',
          err
        );
      } finally {
        this.isRefilling = false;
      }
    })();
  }

  async findPuzzleFromCachedFiles(elo: number): Promise<Puzzle | null> {
    const urls = await this.cacheService.getCachedUrlsMatchingElo(
      elo,
      this.ELO_REFRESH_TOLERANCE
    );
    if (urls.length === 0) return null;

    const randomUrl = urls[Math.floor(Math.random() * urls.length)];
    const puzzles = await this.cacheService.getCachedPuzzles(randomUrl);
    if (!puzzles || puzzles.length === 0) return null;

    return shuffleArray([...puzzles])[0];
  }

  private pickRandomThemes(count: number): string[] {
    return this.pickRandomThemesFrom([...AVAILABLE_THEMES], count);
  }

  private pickRandomThemesFrom(source: string[], count: number): string[] {
    const shuffled = shuffleArray([...source]);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }
}
