/**
 * Traduce lo que hace el jugador (gestos y teclas) en las órdenes del runner. Puro: la parte de eventos
 * del navegador está en el componente del lienzo.
 *
 * En el móvil la mano decide con un gesto:
 *  - tocar: saltar (y si se mantiene pulsado, quedarse en el aire)
 *  - deslizar hacia abajo: agacharse
 *  - deslizar hacia arriba y a la derecha: salto largo
 * Con teclado: Espacio, ↑ o W saltan (mantenerlas flota); ↓ o S agachan; → o D salto largo.
 */

import { GESTURE_SWIPE_PX } from '../config/runner.config';
import { RunnerAction } from '../models/runner.model';

/** Qué es un arrastre desde el punto donde se pulsó; `null` si aún no llega a ser un deslizamiento. */
export function classifySwipe(dx: number, dy: number): Extract<RunnerAction, 'slide' | 'longJump'> | null {
  // Hacia abajo, y más vertical que horizontal
  if (dy >= GESTURE_SWIPE_PX && Math.abs(dx) < dy) {
    return 'slide';
  }
  // Hacia arriba y hacia delante (a la derecha), con algo de ambas cosas
  if (dx >= GESTURE_SWIPE_PX * 0.8 && dy <= -GESTURE_SWIPE_PX * 0.5) {
    return 'longJump';
  }
  return null;
}

export interface KeyCommand {
  action: RunnerAction;
  /** Esta tecla, mientras está pulsada, mantiene a Chocolate en el aire. */
  holds: boolean;
}

const KEY_COMMANDS: Record<string, KeyCommand> = {
  ' ': { action: 'jump', holds: true },
  Spacebar: { action: 'jump', holds: true },
  ArrowUp: { action: 'jump', holds: true },
  w: { action: 'jump', holds: true },
  W: { action: 'jump', holds: true },
  ArrowDown: { action: 'slide', holds: false },
  s: { action: 'slide', holds: false },
  S: { action: 'slide', holds: false },
  ArrowRight: { action: 'longJump', holds: false },
  d: { action: 'longJump', holds: false },
  D: { action: 'longJump', holds: false },
};

export function keyCommand(key: string): KeyCommand | null {
  return KEY_COMMANDS[key] ?? null;
}

/**
 * Cuántas veces cabe el píxel lógico del juego en el ancho de pantalla. El juego se dibuja a una escala
 * entera (el pixel art no admite fracciones) y el ancho lógico cae entre 190 y 260 píxeles.
 */
export function runnerScale(cssWidth: number): number {
  return Math.max(1, Math.round(cssWidth / 220));
}

/** Ancho lógico del lienzo para un ancho de pantalla. */
export function logicalWidth(cssWidth: number): number {
  return Math.floor(cssWidth / runnerScale(cssWidth));
}
