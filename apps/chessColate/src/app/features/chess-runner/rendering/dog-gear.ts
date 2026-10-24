/**
 * El equipo del perrito: cada patrón dominado le añade algo que se ve (una bufanda, una capa, una corona…). Son
 * dibujos de píxeles encima del sprite, colocados con las medidas de su cuadro de 52×40; el sprite no cambia, así que
 * el mismo código sirve en la carrera y en las escenas de la historia.
 */

import { RunnerPowerId } from '../campaign/runner-curriculum';
import { drawPixelArt, Palette, PixelArt } from './pixel-art';

export const DOG_FRAME_W = 52;
export const DOG_FRAME_H = 40;

/** Dónde está cada cosa en el cuadro del perrito (mirando a la derecha). */
const HEAD = { x: 34, y: 4 };
const NECK = { x: 27, y: 15 };
const BACK = { x: 14, y: 12 };
const NOSE = { x: 47, y: 14 };
const EYES = { x: 40, y: 8 };
const CHEST = { x: 19, y: 27 };
const COLLAR = { x: 33, y: 22 };
const PAWS = [10, 40];

const CROWN: PixelArt = ['Y.Y.Y.Y', 'YYYYYYY', 'YrYgYrY', 'YYYYYYY'];
const CROWN_COLORS: Palette = { Y: '#ffd24a', r: '#e0402f', g: '#3fc27a' };
const HEART: PixelArt = ['.R.R.', 'RRRRR', 'RRRRR', '.RRR.', '..R..'];
const HEART_COLORS: Palette = { R: '#e8343f' };
const BELL: PixelArt = ['.Y.', 'YYY', 'YoY'];
const BELL_COLORS: Palette = { Y: '#ffd24a', o: '#b57a12' };
const SPRING: PixelArt = ['Y.Y', '.Y.', 'Y.Y'];
const SPRING_COLORS: Palette = { Y: '#e9d54a' };

/** Qué lleva puesto el perrito: los poderes que ha ganado. */
export type DogGear = ReadonlySet<RunnerPowerId> | readonly RunnerPowerId[];

export interface DogGearOptions {
  /** Segundos: mueve lo que ondea. */
  time: number;
  /** Si mira a la izquierda. */
  flip?: boolean;
  /** Si está en el aire (los muelles se estiran). */
  airborne?: boolean;
}

const has = (gear: DogGear, id: RunnerPowerId): boolean => (gear instanceof Set ? gear.has(id) : (gear as readonly RunnerPowerId[]).includes(id));

/**
 * Dibuja el equipo sobre el sprite del perrito, cuya esquina de arriba a la izquierda está en (x, y).
 * Va tras dibujar el sprite. No hace nada si no lleva ningún poder.
 */
export function drawDogGear(ctx: CanvasRenderingContext2D, gear: DogGear, x: number, y: number, options: DogGearOptions): void {
  const { time, flip = false, airborne = false } = options;
  // Mirando a la izquierda se refleja el cuadro: una posición `px` pasa a ser `FRAME - px`
  const at = (px: number, width: number) => Math.round(x + (flip ? DOG_FRAME_W - px - width : px));
  const rect = (px: number, py: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(at(px, w), Math.round(y + py), w, h);
  };
  const art = (arte: PixelArt, paleta: Palette, px: number, py: number) => {
    const width = Math.max(...arte.map((row) => row.length));
    drawPixelArt(ctx, arte, paleta, at(px, width), Math.round(y + py), flip);
  };
  const wave = (speed: number, amount: number, phase = 0) => Math.round(Math.sin(time * speed + phase) * amount);

  // Detrás del cuerpo: la capa
  if (has(gear, 'cloak')) {
    const flap = wave(14, 1);
    rect(BACK.x + 2, BACK.y, 12, 3, '#6b3fb5');
    rect(BACK.x - 2 + flap, BACK.y + 3, 14, 5, '#7d4fd0');
    rect(BACK.x - 5 + flap, BACK.y + 8, 12, 4, '#6b3fb5');
    rect(BACK.x - 4 + flap, BACK.y + 12, 8, 2, '#563094');
  }
  // La bufanda ondea hacia atrás
  if (has(gear, 'trail')) {
    rect(NECK.x, NECK.y, 8, 3, '#e0402f');
    rect(NECK.x - 4, NECK.y + 2 + wave(12, 1), 6, 3, '#e0402f');
    rect(NECK.x - 9, NECK.y + 4 + wave(12, 1, 1.5), 6, 2, '#b82e22');
  }
  if (has(gear, 'dodge')) {
    rect(HEAD.x, HEAD.y + 4, 11, 2, '#3fc27a');
    rect(HEAD.x - 4, HEAD.y + 5 + wave(13, 1), 4, 2, '#3fc27a');
  }
  if (has(gear, 'net')) {
    art(BELL, BELL_COLORS, COLLAR.x, COLLAR.y);
  }
  if (has(gear, 'heart')) {
    art(HEART, HEART_COLORS, CHEST.x, CHEST.y);
  }
  if (has(gear, 'spring')) {
    // Muelles en las patas: se estiran al saltar
    const lift = airborne ? 2 : 0;
    for (const paw of PAWS) {
      art(SPRING, SPRING_COLORS, paw, DOG_FRAME_H - 5 + lift);
    }
  }
  if (has(gear, 'nose')) {
    const glow = 0.5 + 0.5 * Math.sin(time * 6);
    ctx.fillStyle = `rgba(255, 232, 120, ${(0.55 + 0.4 * glow).toFixed(2)})`;
    ctx.fillRect(at(NOSE.x, 2), Math.round(y + NOSE.y), 2, 2);
    rect(NOSE.x + 3, NOSE.y - 2 + wave(7, 1), 1, 1, '#fff7c4');
  }
  if (has(gear, 'ghost')) {
    // Ojos que brillan en cian
    rect(EYES.x, EYES.y, 2, 2, '#7ff3ff');
    rect(EYES.x + 4, EYES.y, 2, 2, '#7ff3ff');
  }
  if (has(gear, 'crown')) {
    art(CROWN, CROWN_COLORS, HEAD.x, HEAD.y - 3 + wave(5, 1));
  }
}

/** Cuántos poderes lleva puestos (para saber si hay algo que dibujar). */
export function gearCount(gear: DogGear): number {
  return gear instanceof Set ? gear.size : (gear as readonly RunnerPowerId[]).length;
}
