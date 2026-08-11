/**
 * Reto 333: encadenar mates en 1 con el elo subiendo poco a poco, hasta 333.
 *
 * De cada intento solo se guarda el resumen (no los puzzles), porque es lo
 * único que se enseña: la tarjeta del inicio muestra el último intento y, al
 * lado, la mejor marca histórica.
 */
export interface Reto333Record {
  /** Dueño de la marca. Vacío mientras se juega sin sesión. */
  uidUser?: string;
  /** Puzzles resueltos en el último intento. */
  lastScore: number;
  /** Mejor marca histórica, se conserva entre intentos. */
  bestScore: number;
  /** Elo al que llegó la rampa en el último intento. */
  maxElo: number;
  /** Duración del último intento, en segundos. */
  lastTime: number;
  /** La misma duración ya formateada para mostrar (por ejemplo `12m 30s`). */
  timeString: string;
  /** Si el último intento llegó a los 333. */
  completed: boolean;
  /** Cuándo terminó el último intento. */
  lastPlayedAt: number;
}
