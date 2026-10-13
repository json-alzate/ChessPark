import { InjectionToken } from '@angular/core';
import { PuzzlesProvider } from '@chesspark/puzzles-provider';
import { PuzzleSource } from './puzzle-queue';

/**
 * El mismo proveedor que usa ChessColate (CDN de jsDelivr con caché en IndexedDB), sin
 * sesión ni Firebase. En el runner, el perfil persistente de Chrome conserva esa caché.
 */
export const PUZZLE_SOURCE = new InjectionToken<PuzzleSource>('PUZZLE_SOURCE', {
  providedIn: 'root',
  factory: () => {
    const provider = new PuzzlesProvider();
    const ready = provider.init();
    return {
      getPuzzles: async (query) => {
        await ready;
        return provider.getPuzzles(query);
      },
    };
  },
});
