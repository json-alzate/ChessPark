import { Component, ElementRef, inject, Input, ViewChild } from '@angular/core';

import { TranslocoPipe } from '@jsverse/transloco';

import { BoardSizeService } from '@core/app/board-size.service';
import {
  BOARD_KEY_STEP,
  BOARD_RESERVE_PUZZLE,
  BOARD_SIZE_MIN,
  DEFAULT_SENSITIVITY,
  maxBoardSize,
  measureSensitivity,
  Point,
  sizeChangeToReach,
} from '@core/app/board-size.util';

/**
 * Asa de la esquina inferior derecha del tablero para cambiar su tamaño, como en
 * lichess: se arrastra, se mueve con las flechas y un doble clic lo devuelve al
 * tamaño de siempre. Solo existe en escritorio con ratón; en móvil no se ve.
 *
 * Va dentro de la columna del tablero (que debe ser `relative` y llevar la clase
 * `cc-board-column`): se pinta como un cuadrado del ancho de la columna, que es
 * el del tablero, y el asa queda en su esquina. La preferencia es global y
 * vive en `BoardSizeService`.
 *
 * Las columnas de tablero están centradas en la pantalla, así que al crecer el
 * tablero su esquina no se mueve lo mismo que el tamaño y el asa se separaría
 * del puntero. Por eso se mide cuánto se mueve el asa por cada píxel que
 * crece el tablero y se corrige en cada paso hasta alcanzar al puntero.
 */
@Component({
  selector: 'app-board-resize-handle',
  standalone: true,
  imports: [TranslocoPipe],
  templateUrl: './board-resize-handle.component.html',
  styleUrl: './board-resize-handle.component.scss',
})
export class BoardResizeHandleComponent {
  private boardSize = inject(BoardSizeService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * Alto de la ventana que la pantalla aparta para lo que no es tablero. Tiene
   * que coincidir con el de su `cc-board-column` en `global.scss`.
   */
  @Input() reserve: number = BOARD_RESERVE_PUZZLE;

  @ViewChild('grip', { static: true }) grip!: ElementRef<HTMLElement>;

  dragging = false;
  /** Tamaño que enseña el lector de pantalla; se refresca al enfocar o al pasar el ratón. */
  valueNow = 0;

  private sensitivity = DEFAULT_SENSITIVITY;
  /** Dónde agarró el asa el usuario, respecto a su centro: el puntero mantiene esa distancia. */
  private grabOffset: Point = { x: 0, y: 0 };

  readonly minSize = BOARD_SIZE_MIN;

  get maxSize(): number {
    return maxBoardSize(window.innerHeight, this.reserve);
  }

  refresh(): void {
    this.valueNow = Math.round(this.measureSize());
  }

  onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    // Sin esto el navegador empieza a seleccionar texto o a arrastrar la imagen
    event.preventDefault();
    this.grip.nativeElement.setPointerCapture?.(event.pointerId);

    const center = this.gripCenter();
    this.grabOffset = { x: event.clientX - center.x, y: event.clientY - center.y };
    this.sensitivity = DEFAULT_SENSITIVITY;
    this.dragging = true;
    document.body.classList.add('cc-board-resizing');
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.dragging) {
      return;
    }
    const target: Point = {
      x: event.clientX - this.grabOffset.x,
      y: event.clientY - this.grabOffset.y,
    };

    const sizeBefore = this.measureSize();
    const handleBefore = this.gripCenter();
    const change = sizeChangeToReach(
      { x: target.x - handleBefore.x, y: target.y - handleBefore.y },
      this.sensitivity
    );
    this.boardSize.set(sizeBefore + change, this.maxSize);

    // Lo que se movió el asa de verdad, para afinar el siguiente paso
    const sizeAfter = this.measureSize();
    const handleAfter = this.gripCenter();
    this.sensitivity = measureSensitivity(
      sizeAfter - sizeBefore,
      { x: handleAfter.x - handleBefore.x, y: handleAfter.y - handleBefore.y },
      this.sensitivity
    );
  }

  onPointerUp(event: PointerEvent): void {
    if (!this.dragging) {
      return;
    }
    this.dragging = false;
    this.grip.nativeElement.releasePointerCapture?.(event.pointerId);
    document.body.classList.remove('cc-board-resizing');
    this.boardSize.save();
    this.refresh();
  }

  onKeyDown(event: KeyboardEvent): void {
    const direction =
      event.key === 'ArrowRight' || event.key === 'ArrowUp'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
          ? -1
          : 0;
    if (direction === 0) {
      return;
    }
    event.preventDefault();
    this.boardSize.set(this.measureSize() + direction * BOARD_KEY_STEP, this.maxSize);
    this.boardSize.save();
    this.refresh();
  }

  onDoubleClick(): void {
    this.boardSize.reset();
    this.refresh();
  }

  /** Ancho actual de la columna del tablero (el de este cuadrado superpuesto). */
  private measureSize(): number {
    return this.host.nativeElement.getBoundingClientRect().width;
  }

  private gripCenter(): Point {
    const rect = this.grip.nativeElement.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
}
