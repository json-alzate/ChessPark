import { Pipe, PipeTransform, inject } from '@angular/core';

import { AppearanceService } from '@services/app/appearance.service';

/** Colores con los que se pide un rey: nombre completo o inicial de chess.js. */
export type KingColor = 'white' | 'black' | 'w' | 'b';

/**
 * Ruta de la imagen del rey de un color, en el set de piezas que eligió el usuario.
 *
 * Es impuro a propósito: lee el estilo elegido (una señal), y si fuera puro el rey
 * seguiría con el estilo viejo hasta que cambiara el color que recibe.
 */
@Pipe({ name: 'kingImage', standalone: true, pure: false })
export class KingImagePipe implements PipeTransform {
  private appearance = inject(AppearanceService);

  transform(color: KingColor): string {
    const side = color === 'white' || color === 'w' ? 'w' : 'b';
    return `assets/images/pieces/${this.appearance.pieces()}-${side}k.svg`;
  }
}
