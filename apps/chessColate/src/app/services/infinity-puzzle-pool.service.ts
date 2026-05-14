import { Injectable, inject } from '@angular/core';

import { AVAILABLE_THEMES, InfinityPoolEntry, Puzzle, PuzzlesProvider, shuffleArray } from '@chesspark/puzzles-provider';
import { ProfileService } from '@services/profile.service';

@Injectable({
  providedIn: 'root',
})
export class InfinityPuzzlePoolService {
  private readonly POOL_SIZE = 50;
  private readonly PUZZLES_PER_THEME = 5;
  private readonly REFILL_THRESHOLD = 15;
  private readonly ELO_TOLERANCE = 50;
  private readonly INITIAL_BATCH_SIZE = 20;

  private isRefilling = false;

  private puzzlesProvider = inject(PuzzlesProvider);
  private profileService = inject(ProfileService);

  private get cacheService() {
    return this.puzzlesProvider.getCacheService();
  }

  getUserInfinityElo(): number {
    return this.profileService.getEloTotalByPlanType('infinity');
  }

  async getPool(): Promise<InfinityPoolEntry | null> {
    return this.cacheService.getInfinityPool();
  }

  isPoolValid(pool: InfinityPoolEntry, userElo: number): boolean {
    return pool.puzzles.length > 0 && Math.abs(pool.elo - userElo) <= this.ELO_TOLERANCE;
  }

  /** Lee un puzzle aleatorio del pool sin removerlo (para preview en el home) */
  async peekOnePuzzle(): Promise<Puzzle | null> {
    const userElo = this.getUserInfinityElo();
    const pool = await this.getPool();
    if (!pool || !this.isPoolValid(pool, userElo) || pool.puzzles.length === 0) return null;
    const idx = Math.floor(Math.random() * pool.puzzles.length);
    return pool.puzzles[idx];
  }

  /** Elimina un puzzle específico del pool por uid (tras interactuar con él en el home) */
  async removePuzzleFromPool(uid: string): Promise<void> {
    const userElo = this.getUserInfinityElo();
    const pool = await this.getPool();
    if (!pool || !this.isPoolValid(pool, userElo)) return;

    const remaining = pool.puzzles.filter(p => p.uid !== uid);
    await this.cacheService.saveInfinityPool({ ...pool, puzzles: remaining });

    if (remaining.length <= this.REFILL_THRESHOLD) {
      this.refillPoolBackground(userElo);
    }
  }

  async popOnePuzzle(): Promise<Puzzle | null> {
    console.trace('[Pool] popOnePuzzle llamado');
    const userElo = this.getUserInfinityElo();
    const pool = await this.getPool();

    if (!pool || !this.isPoolValid(pool, userElo)) return null;

    const [puzzle, ...remaining] = pool.puzzles;
    console.log(`[Pool] popOnePuzzle: quedan ${remaining.length} después de pop`);
    await this.cacheService.saveInfinityPool({ ...pool, puzzles: remaining });

    if (remaining.length <= this.REFILL_THRESHOLD) {
      this.refillPoolBackground(userElo);
    }

    return puzzle ?? null;
  }

  async takePuzzles(count: number): Promise<Puzzle[]> {
    const userElo = this.getUserInfinityElo();
    const pool = await this.getPool();

    if (!pool || !this.isPoolValid(pool, userElo)) return [];

    const taken = pool.puzzles.slice(0, count);
    const remaining = pool.puzzles.slice(count);
    await this.cacheService.saveInfinityPool({ ...pool, puzzles: remaining });

    if (remaining.length <= this.REFILL_THRESHOLD) {
      this.refillPoolBackground(userElo);
    }

    return taken;
  }

  async buildPool(elo: number): Promise<void> {
    // Si ya hay un pool válido, no reconstruir
    const existing = await this.getPool();
    if (existing && this.isPoolValid(existing, elo)) return;

    const themes = this.pickRandomThemes(10);
    let firstBatchSaved = false;
    const allPuzzles: Puzzle[] = [];

    await Promise.all(
      themes.map(async (t) => {
        const batch = await this.puzzlesProvider
          .getPuzzles({ elo, theme: t, count: this.PUZZLES_PER_THEME })
          .catch(() => [] as Puzzle[]);

        allPuzzles.push(...batch);

        // Guardar pool parcial en cuanto llega el primer batch con puzzles,
        // para que peekOnePuzzle/popOnePuzzle puedan usarlo sin esperar los 10 temas.
        if (!firstBatchSaved && batch.length > 0) {
          firstBatchSaved = true;
          await this.cacheService.saveInfinityPool({
            id: 'infinityPool',
            puzzles: [...allPuzzles],
            elo,
            createdAt: Date.now(),
          });
        }
      })
    );

    const puzzles = shuffleArray(allPuzzles).slice(0, this.POOL_SIZE);
    await this.cacheService.saveInfinityPool({ id: 'infinityPool', puzzles, elo, createdAt: Date.now() });
  }

  refillPoolBackground(elo: number): void {
    if (this.isRefilling) return;
    this.isRefilling = true;

    (async () => {
      try {
        const pool = await this.getPool();

        if (!pool || !this.isPoolValid(pool, elo)) {
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
        const available = AVAILABLE_THEMES.filter((t) => (themeCount.get(t) ?? 0) < this.PUZZLES_PER_THEME);
        const themesToFetch = this.pickRandomThemesFrom(available, Math.ceil(needed / this.PUZZLES_PER_THEME));

        const results = await Promise.all(
          themesToFetch.map((t) => {
            const canFetch = this.PUZZLES_PER_THEME - (themeCount.get(t) ?? 0);
            return this.puzzlesProvider.getPuzzles({ elo, theme: t, count: canFetch }).catch(() => [] as Puzzle[]);
          })
        );

        const newPuzzles = results.flat();
        const merged = shuffleArray([...pool.puzzles, ...newPuzzles]).slice(0, this.POOL_SIZE);
        await this.cacheService.saveInfinityPool({ ...pool, puzzles: merged });
      } catch (err) {
        console.error('[InfinityPuzzlePoolService] Error en refillPoolBackground:', err);
      } finally {
        this.isRefilling = false;
      }
    })();
  }

  async findPuzzleFromCachedFiles(elo: number): Promise<Puzzle | null> {
    const urls = await this.cacheService.getCachedUrlsMatchingElo(elo, this.ELO_TOLERANCE);
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
