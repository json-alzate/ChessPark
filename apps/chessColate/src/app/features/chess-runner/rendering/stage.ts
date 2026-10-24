/**
 * El escenario de las escenas de la historia: dibuja un fotograma (`StageFrame`) con el escenario de un mundo, el
 * perrito en una pose y los objetos de la escena. Un fotograma es solo datos, así las escenas se prueban sin dibujar.
 */

import { RunnerPowerId, RunnerWorld } from '../campaign/runner-curriculum';
import { DOG_FRAME_H, DOG_FRAME_W, drawDogGear } from './dog-gear';
import {
  ALERT_ART,
  ALERT_PALETTE,
  artSize,
  BUBBLE_ICONS,
  BubbleIcon,
  COOKIE_ART,
  COOKIE_PALETTE,
  drawPixelArt,
  JAR_ART,
  JAR_PALETTE,
  PEDESTAL_ART,
  PEDESTAL_PALETTE,
  STAR_ART,
  STAR_EMPTY_PALETTE,
  STAR_PALETTE,
} from './pixel-art';
import { POWER_ICONS } from './power-icons';
import { drawGround, drawScenery, FEET_Y, RUNNER_HEIGHT, Sprites } from './scenery';

/** Cómo está el perrito: dormido, quieto atento, corriendo, saltando, aturdido o contento. */
export type StagePose = 'sleep' | 'idle' | 'run' | 'jump' | 'hurt' | 'happy';

export interface StageDog {
  /** Centro del sprite y altura de los pies sobre el suelo. */
  x: number;
  y: number;
  pose: StagePose;
  /** Mira a la izquierda. */
  flip?: boolean;
  scale?: number;
  alpha?: number;
  /** Lo que lleva puesto (solo se ve corriendo o saltando). */
  gear?: readonly RunnerPowerId[];
}

/** Lo que hay en una escena además del perrito. `x` es el centro; `y`, la altura de la base sobre el suelo. */
export type StageProp =
  | { kind: 'pedestal'; x: number }
  | { kind: 'jar'; x: number; y: number; scale?: number; glow?: number; alpha?: number }
  | { kind: 'piece'; key: string; x: number; y: number; scale: number; tint?: 'none' | 'shadow'; eyes?: number; alpha?: number }
  | { kind: 'cookie'; x: number; y: number; alpha?: number; scale?: number }
  | { kind: 'spark'; x: number; y: number; phase: number }
  | { kind: 'alert'; x: number; y: number }
  | { kind: 'star'; x: number; y: number; scale: number; filled: boolean }
  | { kind: 'power'; id: RunnerPowerId; x: number; y: number; scale: number; alpha?: number }
  /** Un globo con dibujitos (la historia no lleva palabras): `x` e `y` son el centro de abajo del globo; `tail` es hacia dónde apunta su colita. */
  | { kind: 'bubble'; x: number; y: number; icons: readonly BubbleIcon[]; tail?: number; alpha?: number };

export interface StageFrame {
  world: RunnerWorld;
  /** Lo que ha pasado el suelo (mueve el paralaje y las patas del perrito si corre). */
  scroll: number;
  dog: StageDog | null;
  props: StageProp[];
  /** Cuánto se oscurece la imagen (de 0 a 1): para entrar y salir de la escena. */
  fade: number;
  /** Un destello blanco (de 0 a 1). */
  flash: number;
}

export interface StageAssets {
  sprites: Sprites;
  /** Las piezas del set del usuario, por clave (`bk`, `wn`…). */
  pieces: ReadonlyMap<string, CanvasImageSource>;
}

/** Lado del cuadro con que se dibuja una pieza a escala 1: el mismo que en la carrera. */
const PIECE_SIZE = 30;
const STRIDE_PX = 11;

/** Una copia oscurecida (y violeta) de una pieza, para el rey de las sombras y los guardianes. Se guarda para no rehacerla. */
const shadowCache = new WeakMap<object, Map<number, CanvasImageSource>>();

function shadowed(image: CanvasImageSource, size: number): CanvasImageSource {
  const bySize = shadowCache.get(image as object) ?? new Map<number, CanvasImageSource>();
  shadowCache.set(image as object, bySize);
  const cached = bySize.get(size);
  if (cached) {
    return cached;
  }
  let result: CanvasImageSource = image;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(image, 0, 0, size, size);
      // `source-atop` solo pinta donde ya hay pieza: la silueta queda teñida y el fondo, transparente
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(40, 10, 70, 0.78)';
      ctx.fillRect(0, 0, size, size);
      result = canvas;
    }
  } catch {
    result = image;
  }
  bySize.set(size, result);
  return result;
}

/** Dibuja el perrito en su pose. */
function drawStageDog(ctx: CanvasRenderingContext2D, assets: StageAssets, dog: StageDog, time: number, scroll: number): void {
  const { sprites } = assets;
  const name = dog.pose === 'sleep' ? 'dog-hurt' : `dog-${dog.pose}`;
  const sprite = sprites.get(name);
  if (!sprite) {
    return;
  }
  const scale = dog.scale ?? 1;
  let frame = 0;
  switch (dog.pose) {
    case 'run':
      frame = Math.floor(scroll / STRIDE_PX) % sprite.frames;
      break;
    case 'jump':
      frame = 1;
      break;
    case 'sleep':
      frame = 1;
      break;
    default:
      frame = Math.floor(time * sprite.fps) % sprite.frames;
  }
  // Respirar: dormido, el perrito sube y baja un pelín
  const breathe = dog.pose === 'sleep' ? 1 + Math.sin(time * 2.2) * 0.025 : 1;
  const w = sprite.frameW * scale;
  const h = sprite.frameH * scale * breathe;
  const left = Math.round(dog.x - w / 2);
  const top = Math.round(FEET_Y - dog.y - h);

  ctx.save();
  ctx.globalAlpha = dog.alpha ?? 1;
  if (dog.flip) {
    ctx.translate(Math.round(dog.x * 2), 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(sprite.image, frame * sprite.frameW, 0, sprite.frameW, sprite.frameH, left, top, w, h);
  if (dog.gear && dog.gear.length > 0 && (dog.pose === 'run' || dog.pose === 'jump') && scale === 1) {
    drawDogGear(ctx, dog.gear, left, top, { time, airborne: dog.y > 0 });
  }
  ctx.restore();
}

/**
 * Dibuja una pieza apoyada en el suelo, centrada en `x` y a `y` de altura, de `size` px de lado. Con `shadow` sale como una
 * silueta oscura y violeta, y con `eyes` (de 0 a 1) le brillan dos ojos rojos: así son el rey de las sombras y los guardianes.
 */
export function drawPiece(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  size: number,
  options: { shadow?: boolean; eyes?: number; alpha?: number } = {}
): void {
  const left = Math.round(x - size / 2);
  const top = Math.round(FEET_Y + 2 - y - size);
  ctx.save();
  ctx.globalAlpha = options.alpha ?? 1;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(options.shadow ? shadowed(image, size) : image, left, top, size, size);
  ctx.imageSmoothingEnabled = false;
  if ((options.eyes ?? 0) > 0) {
    // Dos ojos rojos que brillan en la sombra
    ctx.fillStyle = `rgba(255, 60, 60, ${options.eyes})`;
    const eyeY = top + Math.round(size * 0.46);
    const gap = Math.max(2, Math.round(size * 0.13));
    ctx.fillRect(Math.round(x - gap - 1), eyeY, 3, 2);
    ctx.fillRect(Math.round(x + gap - 1), eyeY, 3, 2);
  }
  ctx.restore();
}

/** Un globo blanco de bordes redondos con su colita y los dibujitos en fila. */
function drawBubble(ctx: CanvasRenderingContext2D, prop: Extract<StageProp, { kind: 'bubble' }>): void {
  const icons = prop.icons.map((name) => BUBBLE_ICONS[name]);
  const sizes = icons.map((icon) => artSize(icon.art));
  const gap = 3;
  const pad = 4;
  const inner = sizes.reduce((sum, size) => sum + size.width, 0) + gap * Math.max(0, icons.length - 1);
  const height = Math.max(...sizes.map((size) => size.height)) + pad * 2;
  const width = inner + pad * 2;
  const left = Math.round(prop.x - width / 2);
  const bottom = Math.round(FEET_Y - prop.y);
  const top = bottom - height;
  ctx.save();
  ctx.globalAlpha = prop.alpha ?? 1;
  // Borde oscuro y relleno claro, con las esquinas comidas para que parezca redondo
  ctx.fillStyle = '#2b2b2b';
  ctx.fillRect(left + 1, top, width - 2, height);
  ctx.fillRect(left, top + 1, width, height - 2);
  ctx.fillStyle = '#fffdf5';
  ctx.fillRect(left + 2, top + 1, width - 4, height - 2);
  ctx.fillRect(left + 1, top + 2, width - 2, height - 4);
  // La colita, hacia el personaje
  const tail = Math.round(prop.tail ?? prop.x);
  ctx.fillStyle = '#2b2b2b';
  ctx.fillRect(tail - 2, bottom, 5, 1);
  ctx.fillRect(tail - 1, bottom + 1, 3, 1);
  ctx.fillRect(tail, bottom + 2, 1, 1);
  ctx.fillStyle = '#fffdf5';
  ctx.fillRect(tail - 1, bottom - 1, 3, 1);
  ctx.fillRect(tail, bottom, 1, 1);
  let x = left + pad;
  icons.forEach((icon, i) => {
    drawPixelArt(ctx, icon.art, icon.palette, x, top + pad + Math.round((height - pad * 2 - sizes[i].height) / 2));
    x += sizes[i].width + gap;
  });
  ctx.restore();
}

function drawProp(ctx: CanvasRenderingContext2D, assets: StageAssets, prop: StageProp): void {
  switch (prop.kind) {
    case 'pedestal': {
      const { width, height } = artSize(PEDESTAL_ART);
      drawPixelArt(ctx, PEDESTAL_ART, PEDESTAL_PALETTE, Math.round(prop.x - width / 2), FEET_Y + 4 - height);
      break;
    }
    case 'jar': {
      const scale = prop.scale ?? 1;
      const { width, height } = artSize(JAR_ART);
      const left = Math.round(prop.x - (width * scale) / 2);
      const top = Math.round(FEET_Y - prop.y - height * scale);
      ctx.save();
      ctx.globalAlpha = prop.alpha ?? 1;
      if ((prop.glow ?? 0) > 0) {
        // El halo dorado del frasco: late
        const g = prop.glow ?? 0;
        for (let r = 22; r > 8; r -= 4) {
          ctx.fillStyle = `rgba(255, 215, 90, ${(0.05 + 0.07 * g) * (1 - (r - 8) / 18)})`;
          ctx.beginPath();
          ctx.arc(prop.x, top + (height * scale) / 2, r * scale, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.translate(left, top);
      ctx.scale(scale, scale);
      drawPixelArt(ctx, JAR_ART, JAR_PALETTE, 0, 0);
      ctx.restore();
      break;
    }
    case 'piece': {
      const image = assets.pieces.get(prop.key);
      if (image) {
        drawPiece(ctx, image, prop.x, prop.y, Math.round(PIECE_SIZE * prop.scale), {
          shadow: prop.tint === 'shadow',
          eyes: prop.eyes,
          alpha: prop.alpha,
        });
      }
      break;
    }
    case 'cookie': {
      const scale = prop.scale ?? 1;
      ctx.save();
      ctx.globalAlpha = prop.alpha ?? 1;
      ctx.translate(Math.round(prop.x - (9 * scale) / 2), Math.round(FEET_Y - prop.y - 9 * scale));
      ctx.scale(scale, scale);
      drawPixelArt(ctx, COOKIE_ART, COOKIE_PALETTE, 0, 0);
      ctx.restore();
      break;
    }
    case 'spark': {
      const sprite = assets.sprites.get('fx-spark');
      if (sprite) {
        const frame = Math.floor(prop.phase * sprite.fps) % sprite.frames;
        ctx.drawImage(
          sprite.image,
          frame * sprite.frameW,
          0,
          sprite.frameW,
          sprite.frameH,
          Math.round(prop.x - sprite.frameW / 2),
          Math.round(FEET_Y - prop.y - sprite.frameH / 2),
          sprite.frameW,
          sprite.frameH
        );
      }
      break;
    }
    case 'alert': {
      const { width, height } = artSize(ALERT_ART);
      drawPixelArt(ctx, ALERT_ART, ALERT_PALETTE, Math.round(prop.x - width / 2), Math.round(FEET_Y - prop.y - height));
      break;
    }
    case 'star': {
      ctx.save();
      ctx.translate(Math.round(prop.x - (9 * prop.scale) / 2), Math.round(FEET_Y - prop.y - 9 * prop.scale));
      ctx.scale(prop.scale, prop.scale);
      drawPixelArt(ctx, STAR_ART, prop.filled ? STAR_PALETTE : STAR_EMPTY_PALETTE, 0, 0);
      ctx.restore();
      break;
    }
    case 'bubble': {
      drawBubble(ctx, prop);
      break;
    }
    case 'power': {
      const icon = POWER_ICONS[prop.id];
      const { width, height } = { width: Math.max(...icon.art.map((r) => r.length)), height: icon.art.length };
      ctx.save();
      ctx.globalAlpha = prop.alpha ?? 1;
      ctx.translate(Math.round(prop.x - (width * prop.scale) / 2), Math.round(FEET_Y - prop.y - height * prop.scale));
      ctx.scale(prop.scale, prop.scale);
      drawPixelArt(ctx, icon.art, icon.palette, 0, 0);
      ctx.restore();
      break;
    }
  }
}

/** Dibuja un fotograma de una escena en un lienzo de `width` de ancho (y el alto fijo del runner). */
export function drawStage(ctx: CanvasRenderingContext2D, assets: StageAssets, width: number, time: number, frame: StageFrame): void {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, RUNNER_HEIGHT);
  drawScenery(ctx, assets.sprites, { width, distance: frame.scroll, time, world: frame.world });
  drawGround(ctx, assets.sprites, width, frame.scroll);
  // Los objetos van de más lejos a más cerca: primero los de atrás (peldaño, frasco), luego el perrito y delante lo demás
  const behind = frame.props.filter((p) => p.kind === 'pedestal');
  const rest = frame.props.filter((p) => p.kind !== 'pedestal');
  for (const prop of behind) {
    drawProp(ctx, assets, prop);
  }
  if (frame.dog) {
    drawStageDog(ctx, assets, frame.dog, time, frame.scroll);
  }
  for (const prop of rest) {
    drawProp(ctx, assets, prop);
  }
  if (frame.flash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, frame.flash).toFixed(2)})`;
    ctx.fillRect(0, 0, width, RUNNER_HEIGHT);
  }
  if (frame.fade > 0) {
    ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(1, frame.fade).toFixed(2)})`;
    ctx.fillRect(0, 0, width, RUNNER_HEIGHT);
  }
}

export { DOG_FRAME_H, DOG_FRAME_W };
