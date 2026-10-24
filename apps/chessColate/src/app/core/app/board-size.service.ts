import { Injectable, signal } from '@angular/core';

import {
  BOARD_SIZE_MAX,
  clampBoardSize,
  parseStoredBoardSize,
} from './board-size.util';

/**
 * Tamaño del tablero que el usuario eligió en escritorio (el asa de la esquina
 * inferior derecha, como en lichess).
 *
 * Es una preferencia **global**, una para todos los tableros: se guarda en el
 * dispositivo y se publica en la variable CSS `--cc-board-size` de `<html>`.
 * Mientras no haya elegido nada, la variable no existe y cada pantalla usa su
 * tamaño de siempre (ver `.cc-board-column` en `global.scss`).
 */
@Injectable({ providedIn: 'root' })
export class BoardSizeService {
  private readonly STORAGE_KEY = 'chessColate_board_size';
  private readonly CSS_VARIABLE = '--cc-board-size';

  /** Tamaño elegido en píxeles, o `null` si el usuario no ha tocado nada. */
  readonly size = signal<number | null>(null);

  /** Aplica lo guardado. Se llama una vez al arrancar, antes de pintar el primer tablero. */
  init(): void {
    let stored: number | null = null;
    try {
      stored = parseStoredBoardSize(localStorage.getItem(this.STORAGE_KEY));
    } catch {
      // Sin acceso al almacenamiento: se usa el tamaño de cada pantalla
    }
    if (stored !== null) {
      this.apply(stored);
    }
  }

  /**
   * Cambia el tamaño. `max` es el techo de la pantalla desde la que se arrastra.
   * Mientras se arrastra no se guarda cada paso: se llama a `save()` al soltar.
   */
  set(size: number, max: number = BOARD_SIZE_MAX): number {
    const clamped = clampBoardSize(size, max);
    this.apply(clamped);
    return clamped;
  }

  /** Guarda en el dispositivo el tamaño actual. */
  save(): void {
    const size = this.size();
    if (size === null) {
      return;
    }
    try {
      localStorage.setItem(this.STORAGE_KEY, String(size));
    } catch (error) {
      console.error('Error al guardar el tamaño del tablero:', error);
    }
  }

  /** Vuelve al tamaño de siempre de cada pantalla. */
  reset(): void {
    document.documentElement.style.removeProperty(this.CSS_VARIABLE);
    this.size.set(null);
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch {
      // Nada que quitar si no hay acceso
    }
  }

  private apply(size: number): void {
    document.documentElement.style.setProperty(this.CSS_VARIABLE, `${size}px`);
    this.size.set(size);
  }
}
