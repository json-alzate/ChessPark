import { inject, Injectable } from '@angular/core';

import { Puzzle } from '@chesspark/models';
import { getManifestThemes, PuzzlesProvider } from '@chesspark/puzzles-provider';

import { STREAK_EXCLUDED_THEMES } from '@features/streak/utils/streak.util';

/**
 * De dónde sale el ejercicio de cada carrera: uno del catálogo, de un tema al azar, cerca del ELO del
 * usuario y distinto de los ya jugados en la sesión.
 *
 * El Chess Runner no toca el ELO del usuario (es un calentamiento), así que no hace falta una rampa
 * como la de la Racha: basta con el ELO de partida y que el tema cambie.
 */
@Injectable({ providedIn: 'root' })
export class RunnerPuzzleService {
  private puzzlesProvider = inject(PuzzlesProvider);

  /** Temas distintos que se prueban antes de rendirse (cada uno puede traer un archivo de cientos de KB). */
  private readonly ATTEMPTS = 4;
  private readonly FETCH_COUNT = 20;
  /**
   * Tiempo tras el que no se prueba otro tema: con el catálogo sin responder cada tema agota sus tiempos de
   * espera (unos 16 s) y cuatro seguidos dejarían la pantalla en «Buscando…» más de un minuto. Con el error a la
   * vista el usuario puede reintentar, que elige otros temas.
   */
  private readonly TIME_BUDGET_MS = 12_000;

  private get themes(): string[] {
    return getManifestThemes().filter((theme) => !STREAK_EXCLUDED_THEMES.includes(theme));
  }

  /** Un ejercicio nuevo, o `null` si el catálogo no responde (sin conexión y sin caché). */
  async next(elo: number, played: Set<string>, random: () => number = Math.random): Promise<Puzzle | null> {
    const themes = [...this.themes].sort(() => random() - 0.5);
    const startedAt = Date.now();

    for (const theme of themes.slice(0, this.ATTEMPTS)) {
      if (Date.now() - startedAt >= this.TIME_BUDGET_MS) {
        break;
      }
      try {
        const puzzles = await this.puzzlesProvider.getPuzzles({
          elo,
          theme,
          count: this.FETCH_COUNT,
        });
        const fresh = puzzles.filter((puzzle) => !played.has(puzzle.uid));
        if (fresh.length > 0) {
          return fresh[Math.floor(random() * fresh.length)];
        }
      } catch (error) {
        console.warn('Error pidiendo un ejercicio para el runner:', error);
      }
    }
    return null;
  }
}
