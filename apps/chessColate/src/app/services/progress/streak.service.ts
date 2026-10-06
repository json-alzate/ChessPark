import { inject, Injectable } from '@angular/core';

import { Puzzle, StreakConfig } from '@cpark/models';
import {
  buildPuzzleUrl,
  getManifestThemes,
  getValidEloStarts,
  MANIFEST_ELO_STEP,
  PuzzlesProvider,
} from '@chesspark/puzzles-provider';

import { pickTheme, STREAK_EXCLUDED_THEMES } from './streak.util';

/**
 * Fuente de puzzles del modo Racha.
 *
 * A diferencia de las rutinas, aquí no hay bloque ni lote precargado: cada
 * puzzle se pide con el elo que marca la rampa, con un tema distinto para dar
 * variedad y sin repetir ninguno dentro de la misma racha.
 */
@Injectable({
  providedIn: 'root',
})
export class StreakService {
  private puzzlesProvider = inject(PuzzlesProvider);

  /**
   * Anchos de banda alrededor del elo objetivo, de más estrecho a más ancho.
   * Se empieza pegado al objetivo para que la rampa se note; si el catálogo no
   * devuelve nada nuevo, se abre la banda antes que dejar la racha sin puzzle.
   *
   * La primera es 0 a propósito. El catálogo guarda los puzzles en archivos de
   * 20 puntos de elo que pesan entre 250 y 700 KB, y una banda más ancha obliga
   * a bajar varios por puzzle. Pedir justo el archivo del objetivo baja **uno
   * solo** y, como dentro hay cientos de puzzles repartidos en esos 20 puntos,
   * la puntería es casi exacta. Las bandas anchas son solo el plan B.
   */
  private readonly ELO_BANDS = [0, 100, 300];

  /** Intentos (temas distintos) por cada ancho de banda. */
  private readonly ATTEMPTS_PER_BAND = 3;

  /**
   * Cuántos puzzles pedir al catálogo en cada intento. Basta un puñado: solo
   * se juega uno, y pedir menos evita descargar archivos de más.
   */
  private readonly FETCH_COUNT = 30;

  /**
   * A partir de cuántos temas ya descargados se prefiere tirar de la caché.
   * Con menos de esto la mezcla quedaría pobre y sale más a cuenta descargar.
   */
  private readonly MIN_CACHED_THEMES = 5;

  /** Temas del catálogo que entran en la mezcla de la racha. */
  private get mixThemes(): string[] {
    return getManifestThemes().filter(
      (theme) => !STREAK_EXCLUDED_THEMES.includes(theme)
    );
  }

  /**
   * Temas que de verdad tienen un archivo de puzzles a ese elo. Filtrar por el
   * manifiesto evita pedir URLs que no existen y quedarnos sin puzzle.
   */
  private themesAvailableAt(elo: number): string[] {
    const bucket = Math.floor(elo / MANIFEST_ELO_STEP) * MANIFEST_ELO_STEP;
    return this.mixThemes.filter((theme) =>
      getValidEloStarts(theme)?.has(bucket)
    );
  }

  /**
   * De los temas candidatos, los que ya tienen su archivo descargado para ese
   * elo. Preferirlos hace que volver a jugar no cueste datos: los archivos
   * pesan entre 250 y 700 KB y con la caché llena la racha va sin red.
   */
  private async cachedThemesAt(
    elo: number,
    candidates: string[]
  ): Promise<string[]> {
    const { cdnBaseUrl, githubUser } = this.puzzlesProvider.getConfig();
    const cacheService = this.puzzlesProvider.getCacheService();

    const checked = await Promise.all(
      candidates.map(async (theme) => {
        const url = buildPuzzleUrl(cdnBaseUrl, githubUser, elo, theme);
        try {
          return (await cacheService.isFileCached(url)) ? theme : null;
        } catch {
          return null;
        }
      })
    );

    return checked.filter((theme): theme is string => theme !== null);
  }

  /**
   * Devuelve un puzzle para el elo objetivo, distinto de los ya jugados en la
   * racha. `null` si el catálogo no puede servir ninguno (sin conexión y sin
   * caché); el llamador decide qué hacer.
   */
  async getPuzzleForElo(
    targetElo: number,
    config: StreakConfig,
    excludedUids: Set<string>
  ): Promise<Puzzle | null> {
    const available = this.themesAvailableAt(targetElo);
    const cached = await this.cachedThemesAt(targetElo, available);
    // Con caché de sobra se juega sin descargar nada; si aún hay poca, se
    // descarga y de paso se amplía para las siguientes rachas.
    const preferred =
      cached.length >= this.MIN_CACHED_THEMES ? cached : available;

    for (const band of this.ELO_BANDS) {
      for (let attempt = 0; attempt < this.ATTEMPTS_PER_BAND; attempt++) {
        // Solo el primer intento tira de la caché: un archivo trae cientos de
        // puzzles, así que si ese no sirve es que hay que descargar.
        const isFirstTry = band === this.ELO_BANDS[0] && attempt === 0;
        const theme = pickTheme(config, isFirstTry ? preferred : available);

        let puzzles: Puzzle[] = [];
        try {
          puzzles = await this.puzzlesProvider.getPuzzles({
            elo: targetElo,
            eloMin: targetElo - band,
            eloMax: targetElo + band,
            theme,
            count: this.FETCH_COUNT,
          });
        } catch (error) {
          console.warn('Error pidiendo puzzles para la racha:', error);
          continue;
        }

        const fresh = puzzles.filter((puzzle) => !excludedUids.has(puzzle.uid));
        if (fresh.length > 0) {
          // Pidiendo el archivo exacto, todos los candidatos caen en la misma
          // franja de 20 puntos: elegir al azar hace que el elo ronde el
          // objetivo por sí solo, sin descargar nada de más. En las bandas
          // anchas, que son el plan B, sí interesa el más cercano.
          return band === 0
            ? this.randomOf(fresh)
            : this.closestTo(targetElo, fresh);
        }
      }
    }

    return null;
  }

  /** Uno cualquiera de los candidatos. */
  private randomOf(puzzles: Puzzle[]): Puzzle {
    return puzzles[Math.floor(Math.random() * puzzles.length)];
  }

  /**
   * De los candidatos, el de dificultad más cercana al objetivo. Vienen ya
   * mezclados del proveedor, así que entre empates la elección es aleatoria.
   */
  private closestTo(targetElo: number, puzzles: Puzzle[]): Puzzle {
    return puzzles.reduce((best, puzzle) =>
      Math.abs(puzzle.rating - targetElo) < Math.abs(best.rating - targetElo)
        ? puzzle
        : best
    );
  }
}
