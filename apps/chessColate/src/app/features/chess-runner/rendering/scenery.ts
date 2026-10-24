/**
 * El escenario del Chess Runner: cielo, nubes, horizonte, colinas, el tono y los efectos de cada mundo y el suelo de
 * tablero. Lo comparten la carrera y las escenas de la historia, así que no sabe de estados de juego: recibe lo justo
 * para dibujar un instante (cuánto ha avanzado el suelo, el reloj y el mundo).
 */

import { RUNNER_CANVAS_HEIGHT } from '../config/runner.config';
import { RunnerWorld } from '../campaign/runner-curriculum';
import { RunnerSprite } from '../services/runner-sprites.service';

export type Sprites = ReadonlyMap<string, RunnerSprite>;

/** Alto del lienzo lógico (el ancho depende de la pantalla; el alto es fijo). */
export const RUNNER_HEIGHT = RUNNER_CANVAS_HEIGHT;
/** Borde de arriba del tablero que hace de suelo. */
export const GROUND_Y = 142;
/** Donde apoyan los pies del perrito y la base de las piezas: en mitad de las casillas. */
export const FEET_Y = GROUND_Y + 8;

const FLOOR_TILE_H = 20;
const WOOD = '#3a2418';

/** Lo que hace falta saber de un instante para dibujar el escenario. */
export interface SceneryView {
  width: number;
  /** Lo que ha pasado el suelo desde el principio, en píxeles (mueve el paralaje). */
  distance: number;
  /** Segundos: mueve lo que se anima solo (estrellas, niebla, lluvia). */
  time: number;
  world: RunnerWorld;
}

/** Cómo se tiñe el escenario en cada mundo: el color por encima del cielo y las colinas. */
export const WORLD_TINT: Record<RunnerWorld, string | null> = {
  day: null,
  sunset: 'rgba(255, 130, 50, 0.26)',
  night: 'rgba(12, 20, 70, 0.58)',
  mist: 'rgba(150, 170, 190, 0.42)',
  dawn: 'rgba(255, 120, 175, 0.22)',
  storm: 'rgba(70, 20, 40, 0.55)',
};

/** Estrellas del mundo de noche: (x relativa al ancho, y), fijas. */
const STARS: [number, number][] = [
  [0.08, 14], [0.2, 38], [0.33, 10], [0.45, 26], [0.58, 12], [0.7, 40], [0.82, 20], [0.93, 34], [0.15, 56], [0.62, 52],
];

/** Un disco de píxeles: sol o luna. */
function disc(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, color: string): void {
  ctx.fillStyle = color;
  for (let dy = -radius; dy <= radius; dy++) {
    const half = Math.floor(Math.sqrt(radius * radius - dy * dy));
    ctx.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2 + 1, 1);
  }
}

/** El astro de cada mundo, detrás de las colinas: sol de día, sol grande y bajo al atardecer, luna de noche, sol que sale al amanecer. */
function drawCelestial(ctx: CanvasRenderingContext2D, view: SceneryView): void {
  const { width, world } = view;
  switch (world) {
    case 'day':
      disc(ctx, width - 30, 30, 11, 'rgba(255, 236, 160, 0.30)');
      disc(ctx, width - 30, 30, 7, '#ffe27a');
      break;
    case 'sunset':
      disc(ctx, width * 0.7, GROUND_Y - 34, 16, 'rgba(255, 150, 60, 0.35)');
      disc(ctx, width * 0.7, GROUND_Y - 34, 11, '#ff9a3c');
      break;
    case 'night': {
      // La luna: un disco claro con su halo y un par de cráteres
      const cx = Math.round(width * 0.8);
      disc(ctx, cx, 28, 13, 'rgba(244, 241, 208, 0.18)');
      disc(ctx, cx, 28, 9, '#f4f1d0');
      ctx.fillStyle = '#d9d5ad';
      ctx.fillRect(cx - 4, 25, 3, 2);
      ctx.fillRect(cx + 2, 30, 3, 3);
      ctx.fillRect(cx - 1, 33, 2, 1);
      break;
    }
    case 'dawn':
      disc(ctx, width * 0.32, GROUND_Y - 6, 18, 'rgba(255, 190, 150, 0.30)');
      disc(ctx, width * 0.32, GROUND_Y - 6, 11, '#ffd1a1');
      break;
    default:
      break;
  }
}

/** Efectos que pasan por delante de las colinas: estrellas, niebla y lluvia con relámpagos. */
function drawWeather(ctx: CanvasRenderingContext2D, view: SceneryView): void {
  const { width, world, time, distance } = view;
  if (world === 'night' || world === 'storm') {
    STARS.forEach(([x, y], index) => {
      const twinkle = Math.floor(time * 2 + index) % 3 === 0;
      ctx.fillStyle = twinkle ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.95)';
      ctx.fillRect(Math.round(x * width), y, 1, 1);
    });
  }
  if (world === 'mist') {
    // Bandas de niebla que se desplazan despacio, a distintas alturas
    ctx.fillStyle = 'rgba(232, 238, 245, 0.24)';
    [GROUND_Y - 46, GROUND_Y - 30, GROUND_Y - 14].forEach((y, i) => {
      const drift = ((distance * (0.04 + i * 0.015) + i * 70) % (width + 120)) - 60;
      ctx.fillRect(Math.round(width - drift - 140), y, 140, 7);
      ctx.fillRect(Math.round(-drift), y + 3, 120, 6);
    });
  }
  if (world === 'storm') {
    // Lluvia en diagonal y, de vez en cuando, un relámpago que ilumina todo un instante
    ctx.fillStyle = 'rgba(190, 200, 230, 0.5)';
    for (let i = 0; i < 18; i++) {
      const fall = (time * 160 + i * 53) % (GROUND_Y + 10);
      const x = Math.round(((i * 37 + time * -40) % width + width) % width);
      ctx.fillRect(x, Math.round(fall), 1, 5);
    }
    if (Math.floor(time * 10) % 47 === 0) {
      ctx.fillStyle = 'rgba(255, 250, 220, 0.30)';
      ctx.fillRect(0, 0, width, GROUND_Y + 6);
    }
  }
}

/** Cielo, astro, nubes, horizonte, colinas, el tono del mundo y su clima: todo lo que va detrás de lo que juega. */
export function drawScenery(ctx: CanvasRenderingContext2D, sprites: Sprites, view: SceneryView): void {
  const { width, distance, world } = view;
  const sky = sprites.get('scene-sky');
  if (sky) {
    // La tira del cielo es de 4 px de ancho: se estira (todas sus columnas son iguales)
    ctx.drawImage(sky.image, 0, 0, sky.frameW, sky.frameH, 0, 0, width, GROUND_Y + 6);
  }
  drawCelestial(ctx, view);

  // Las nubes avanzan lento y las colinas algo más: el paralaje da sensación de profundidad
  const clouds: [string, number, number][] = [['scene-cloud-0', 20, 0.06], ['scene-cloud-1', 52, 0.1]];
  for (const [name, y, speed] of clouds) {
    const cloud = sprites.get(name);
    if (cloud) {
      const span = width + cloud.frameW * 2;
      const x = ((((distance * speed + (name === 'scene-cloud-1' ? 120 : 0)) % span) + span) % span);
      ctx.drawImage(cloud.image, Math.round(width - x), y);
    }
  }

  // Un horizonte de piezas de ajedrez gigantes, muy lejos (lo que más tarda en pasar)
  const skyline = sprites.get('scene-skyline');
  if (skyline) {
    const offset = (distance * 0.1) % skyline.frameW;
    for (let x = -offset; x < width; x += skyline.frameW) {
      ctx.drawImage(skyline.image, Math.round(x), GROUND_Y - skyline.frameH + 14);
    }
  }

  const hills = sprites.get('scene-hills');
  if (hills) {
    const offset = (distance * 0.25) % hills.frameW;
    for (let x = -offset; x < width; x += hills.frameW) {
      ctx.drawImage(hills.image, Math.round(x), GROUND_Y - hills.frameH + 6);
    }
  }

  const tint = WORLD_TINT[world];
  if (tint) {
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, width, GROUND_Y + 6);
  }
  drawWeather(ctx, view);
}

/** El suelo de tablero, que pasa con la carrera, y la madera de debajo. */
export function drawGround(ctx: CanvasRenderingContext2D, sprites: Sprites, width: number, distance: number): void {
  const floor = sprites.get('scene-floor');
  if (!floor) {
    return;
  }
  const offset = distance % floor.frameW;
  for (let x = -offset; x < width; x += floor.frameW) {
    ctx.drawImage(floor.image, Math.round(x), GROUND_Y);
  }
  ctx.fillStyle = WOOD;
  ctx.fillRect(0, GROUND_Y + FLOOR_TILE_H, width, RUNNER_HEIGHT - GROUND_Y - FLOOR_TILE_H);
}
