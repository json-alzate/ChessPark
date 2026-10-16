import { Injectable } from '@angular/core';

/**
 * Lo único que el Chess Runner recuerda en el dispositivo: el récord de distancia (en metros) de una
 * partida, como el del dinosaurio de Chrome. Una partida es la cadena de carreras y ejercicios hasta que
 * se pierde (3 choques o 3 ejercicios fallidos). Sin acceso al almacenamiento el juego sigue, sin récord.
 */
@Injectable({ providedIn: 'root' })
export class RunnerRecordService {
  private readonly KEY = 'chessColate_runner_best_m';

  /** Mejor distancia guardada, en metros (0 si no hay). */
  best(): number {
    try {
      const value = Number(localStorage.getItem(this.KEY));
      return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
    } catch {
      return 0;
    }
  }

  /** Guarda `meters` si supera el récord. Devuelve `true` si lo es. */
  save(meters: number): boolean {
    const value = Math.floor(meters);
    if (!(value > this.best())) {
      return false;
    }
    try {
      localStorage.setItem(this.KEY, String(value));
    } catch (error) {
      console.error('Error al guardar el récord del runner:', error);
      return false;
    }
    return true;
  }
}
