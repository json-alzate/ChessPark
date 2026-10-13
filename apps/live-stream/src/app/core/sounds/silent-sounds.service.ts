import { Injectable } from '@angular/core';

/**
 * Sustituto mudo de `SoundsService`.
 *
 * El reproductor del tablero lo inyecta siempre, y el real carga los audios de
 * `assets/sounds/` apenas se construye. En el directo el audio es solo la playlist
 * lofi que mezcla ffmpeg, así que aquí no hay nada que sonar ni que descargar.
 */
@Injectable()
export class SilentSoundsService {
  determineChessMoveType(): void {
    // Sin sonido de jugadas.
  }
}
