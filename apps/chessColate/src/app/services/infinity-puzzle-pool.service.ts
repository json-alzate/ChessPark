import { Injectable, OnDestroy, inject } from '@angular/core';
import { Store, select } from '@ngrx/store';
import { Subscription, distinctUntilChanged, filter, take } from 'rxjs';

import { AuthState, getIsInitialized, getProfile } from '@cpark/state';
import { InfinityPoolPuzzle, InfinityPuzzlePool, Puzzle } from '@cpark/models';
import { StorageService } from '@chesspark/common-utils';
import { PuzzlesProvider } from '@chesspark/puzzles-provider';

import { ProfileService } from '@services/profile.service';
import { AppService } from '@services/app.service';

@Injectable({ providedIn: 'root' })
export class InfinityPuzzlePoolService implements OnDestroy {
  private readonly STORAGE_KEY = 'infinity_puzzle_pool';
  private readonly POOL_SIZE = 10;
  private readonly POOL_TTL_MS = 4 * 60 * 60 * 1000; // 4 horas
  private readonly RELOAD_THRESHOLD = 3;
  // Distribución: 7 al ELO del usuario, 2 a ELO-200, 1 a ELO+300
  private readonly ELO_OFFSETS = [0, 0, 0, 0, 0, 0, 0, -200, -200, 300];

  private pool: InfinityPuzzlePool | null = null;
  private isLoading = false;
  private reloadInProgress = false;
  private initialized = false;
  private authSubscription?: Subscription;
  private profileSubscription?: Subscription;

  private store = inject(Store<AuthState>);
  private storageService = inject(StorageService);
  private appService = inject(AppService);
  private puzzlesProvider = inject(PuzzlesProvider);
  private profileService = inject(ProfileService);

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Restaurar pool desde storage si existe y no expiró
    const stored = this.loadFromStorage();
    if (stored) {
      this.pool = stored;
    }

    // Esperar a que el estado de auth esté determinado
    this.authSubscription = this.store.pipe(
      select(getIsInitialized),
      filter(init => init),
      take(1)
    ).subscribe(() => {
      // Auth determinado — ahora suscribirse a cambios de perfil relevantes
      this.profileSubscription = this.store.pipe(
        select(getProfile),
        distinctUntilChanged((a, b) => {
          const wasAnon = !a;
          const isAnon = !b;
          const eloA = a?.eloPuzzles ?? 1500;
          const eloB = b?.eloPuzzles ?? 1500;
          return wasAnon === isAnon && eloA === eloB;
        })
      ).subscribe(profile => {
        const elo = profile?.eloPuzzles ?? 1500;
        const isAnonymous = !profile;

        if (this.pool && !this.shouldDiscardPool(this.pool, elo, isAnonymous)) {
          this.checkAndReload(elo, isAnonymous);
        } else {
          this.pool = null;
          this.storageService.remove(this.STORAGE_KEY);
          this.loadPool(elo, isAnonymous);
        }
      });
    });
  }

  /** Devuelve un puzzle aleatorio no resuelto del pool, o null si no hay. */
  getRandomUnsolvedPuzzle(): InfinityPoolPuzzle | null {
    if (!this.pool) return null;
    const unsolved = this.pool.puzzles.filter(p => !p.solved);
    if (unsolved.length === 0) return null;
    return unsolved[Math.floor(Math.random() * unsolved.length)];
  }

  /** Marca el puzzle con el uid dado como resuelto y dispara recarga si corresponde. */
  markPuzzleAsSolved(puzzleUid: string): void {
    if (!this.pool) return;
    const puzzle = this.pool.puzzles.find(p => p.uid === puzzleUid);
    if (puzzle) {
      puzzle.solved = true;
      this.persistPool();
      const elo = this.profileService.eloPuzzles;
      const isAnonymous = !this.profileService.getProfile;
      this.checkAndReload(elo, isAnonymous);
    }
  }

  /**
   * Retorna los puzzles no resueltos del pool como Puzzle[] para usar como
   * batch inicial del plan continuo. Limpia el pool del storage (se recargará).
   */
  consumePoolForPlan(): Puzzle[] {
    if (!this.pool) return [];
    const unresolved = this.pool.puzzles
      .filter(p => !p.solved)
      .map(({ poolTheme: _pt, eloOffset: _eo, solved: _s, ...puzzle }) => puzzle as Puzzle);

    this.pool = null;
    this.storageService.remove(this.STORAGE_KEY);
    return unresolved;
  }

  getIsLoading(): boolean {
    return this.isLoading;
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
    this.profileSubscription?.unsubscribe();
  }

  private async loadPool(elo: number, isAnonymous: boolean): Promise<void> {
    if (this.isLoading) return;
    this.isLoading = true;

    try {
      const themes = this.getNonRepeatingThemes(this.POOL_SIZE);

      const puzzlePromises = this.ELO_OFFSETS.map((offset, index) => {
        const slotElo = Math.min(2800, Math.max(400, elo + offset));
        return this.puzzlesProvider.getPuzzles({
          elo: slotElo,
          theme: themes[index],
          count: 1,
        }).then(puzzles => ({
          puzzle: puzzles?.[0] ?? null,
          theme: themes[index],
          offset,
        }));
      });

      const results = await Promise.all(puzzlePromises);

      const poolPuzzles: InfinityPoolPuzzle[] = results
        .filter(r => r.puzzle !== null)
        .map(r => ({
          ...(r.puzzle as Puzzle),
          poolTheme: r.theme,
          eloOffset: r.offset,
          solved: false,
        }));

      this.pool = {
        puzzles: poolPuzzles,
        eloUsed: elo,
        isAnonymousElo: isAnonymous,
        loadedAt: Date.now(),
      };

      this.persistPool();
    } catch (error) {
      console.error('[InfinityPuzzlePoolService] Error cargando pool:', error);
    } finally {
      this.isLoading = false;
    }
  }

  private checkAndReload(elo: number, isAnonymous: boolean): void {
    if (!this.pool || this.reloadInProgress || this.isLoading) return;
    const unsolved = this.pool.puzzles.filter(p => !p.solved).length;
    if (unsolved <= this.RELOAD_THRESHOLD) {
      this.reloadInProgress = true;
      this.loadPool(elo, isAnonymous).finally(() => {
        this.reloadInProgress = false;
      });
    }
  }

  private shouldDiscardPool(pool: InfinityPuzzlePool, elo: number, isAnonymous: boolean): boolean {
    if (pool.isAnonymousElo && !isAnonymous) return true;
    if (Math.abs(pool.eloUsed - elo) > 200) return true;
    if (Date.now() - pool.loadedAt > this.POOL_TTL_MS) return true;
    return false;
  }

  private getNonRepeatingThemes(count: number): string[] {
    const allThemes = this.appService.getThemesPuzzlesList
      .map((t: any) => t.value)
      .filter((v: string) => !!v);

    if (allThemes.length === 0) return Array(count).fill('middlegame');

    // Fisher-Yates shuffle
    const shuffled = [...allThemes];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const result: string[] = [];
    let pass = [...shuffled];
    for (let i = 0; i < count; i++) {
      if (pass.length === 0) {
        pass = [...shuffled].sort(() => Math.random() - 0.5);
      }
      result.push(pass.shift()!);
    }
    return result;
  }

  private persistPool(): void {
    if (!this.pool) return;
    this.storageService.set(this.STORAGE_KEY, this.pool);
  }

  private loadFromStorage(): InfinityPuzzlePool | null {
    return this.storageService.get<InfinityPuzzlePool>(this.STORAGE_KEY);
  }
}
