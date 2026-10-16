import {
  COOKIE_SIZE,
  PIECE_BEHAVIOR,
  PIECE_DRAW_SIZE,
  RUNNER_CANVAS_HEIGHT,
  RUNNER_PHYSICS,
  RunnerWorld,
  worldOfLevel,
} from '../../config/runner.config';
import { RunnerCookie, RunnerObstacle, RunnerState } from '../../models/runner.model';
import { RunnerPieceSet } from '../../services/runner-pieces.service';
import { RunnerSprite } from '../../services/runner-sprites.service';
import { pieceKey } from '../../utils/runner-sequence.util';

/** Medidas del lienzo lógico (el ancho depende de la pantalla; el alto es fijo). */
export const RUNNER_HEIGHT = RUNNER_CANVAS_HEIGHT;
/** Borde de arriba del tablero que hace de suelo. */
export const GROUND_Y = 142;
/** Donde apoyan los pies de Chocolate y la base de las piezas: en mitad de las casillas. */
export const FEET_Y = GROUND_Y + 8;

const FLOOR_TILE_H = 20;
/** Lo que baja el cuadro de la pieza bajo el suelo: las piezas dejan un margen vacío abajo. */
const PIECE_FOOT_PADDING = 2;
const WOOD = '#3a2418';
/** Lo que dura la sacudida tras un tropiezo, en segundos. */
const SHAKE_TIME = 0.25;
/** Cuántos píxeles de suelo recorre Chocolate entre un fotograma de su carrera y el siguiente. */
const STRIDE_PX = 11;

type Sprites = ReadonlyMap<string, RunnerSprite>;

/** La galleta de ChessColate en pixel art (9×9): `X` borde, `o` masa, `h` brillo y `c` chispas de chocolate. */
const COOKIE_ART = [
  '..XXXXX..',
  '.XhhoooX.',
  'XhooocooX',
  'XoocooooX',
  'XoooooocX',
  'XocoooooX',
  'XoooocooX',
  '.XoooooX.',
  '..XXXXX..',
];
const COOKIE_COLORS: Record<string, string> = { X: '#6b3d17', o: '#d99a52', h: '#f2c987', c: '#3a1f0c' };

/** Cómo se tiñe el escenario en cada mundo: el color por encima del cielo y las colinas. */
const WORLD_TINT: Record<RunnerWorld, string | null> = {
  day: null,
  sunset: 'rgba(255, 130, 50, 0.26)',
  night: 'rgba(12, 20, 70, 0.58)',
  dawn: 'rgba(255, 120, 175, 0.22)',
};
/** Estrellas del mundo de noche: (x relativa al ancho, y), fijas. */
const STARS: [number, number][] = [
  [0.08, 14], [0.2, 38], [0.33, 10], [0.45, 26], [0.58, 12], [0.7, 40], [0.82, 20], [0.93, 34], [0.15, 56], [0.62, 52],
];

/** Un efecto breve (polvo, chispa) que se dibuja mientras dura su animación. */
export type RunnerFxKind = 'dust' | 'spark';

interface ActiveFx {
  kind: RunnerFxKind;
  x: number;
  y: number;
  /** Segundo de la carrera en que nació. */
  start: number;
}

/**
 * Dibuja un instante del runner. No sabe de Angular ni del bucle: recibe el estado y pinta. Todo en
 * píxeles lógicos; quien lo crea fija la escala del lienzo. Chocolate y el escenario son pixel art (sin
 * suavizado); las piezas son las del set que el usuario eligió para el tablero, que son vectoriales.
 */
export class RunnerRenderer {
  private fx: ActiveFx[] = [];

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly sprites: Sprites,
    private readonly pieces: RunnerPieceSet['images'],
    private width: number
  ) {}

  resize(width: number): void {
    this.width = width;
  }

  /** Suelta un efecto en (x, y): `y` es la altura sobre el suelo. */
  addFx(kind: RunnerFxKind, x: number, y: number, time: number): void {
    this.fx.push({ kind, x, y, start: time });
  }

  draw(state: RunnerState): void {
    const { ctx } = this;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, this.width, RUNNER_HEIGHT);

    // Un tropiezo sacude la escena un instante
    const shaking = state.dog.stumble > RUNNER_PHYSICS.stumbleTime - SHAKE_TIME;
    if (shaking) {
      ctx.save();
      const strength = (state.dog.stumble - (RUNNER_PHYSICS.stumbleTime - SHAKE_TIME)) / SHAKE_TIME;
      ctx.translate(Math.round(Math.sin(state.time * 90) * 2 * strength), Math.round(Math.cos(state.time * 70) * 1.5 * strength));
    }
    this.drawBackground(state);
    this.drawWorld(state);
    this.drawFloor(state);
    for (const cookie of state.pickups) {
      this.drawCookie(cookie, state.time);
    }
    for (const obstacle of state.obstacles) {
      this.drawObstacle(obstacle);
    }
    this.drawFx(state);
    this.drawDog(state);
    this.drawSpeedLines(state);
    if (shaking) {
      ctx.restore();
    }
  }

  /** Rayitas que cruzan el aire cuando el suelo va rápido: se nota la velocidad sin leer ningún número. */
  private drawSpeedLines(state: RunnerState): void {
    const base = state.difficulty.startSpeed;
    const boost = Math.min(1, Math.max(0, (state.speed - base) / 60 + (state.difficulty.level - 1) / 12));
    if (boost <= 0.05) {
      return;
    }
    const { ctx } = this;
    ctx.fillStyle = `rgba(255, 255, 255, ${(0.18 + 0.2 * boost).toFixed(2)})`;
    const lines = 2 + Math.round(boost * 4);
    for (let i = 0; i < lines; i++) {
      const lane = 24 + ((i * 37) % 80);
      const length = 8 + ((i * 11) % 10) + Math.round(boost * 10);
      const x = this.width - ((state.distance * (1.6 + (i % 3) * 0.4) + i * 61) % (this.width + length));
      ctx.fillRect(Math.round(x), lane, length, 1);
    }
  }

  private drawFx(state: RunnerState): void {
    this.fx = this.fx.filter((effect) => {
      const sprite = this.sprites.get(`fx-${effect.kind}`);
      if (!sprite) {
        return false;
      }
      const frame = Math.floor((state.time - effect.start) * sprite.fps);
      if (frame >= sprite.frames) {
        return false;
      }
      this.ctx.drawImage(
        sprite.image,
        frame * sprite.frameW,
        0,
        sprite.frameW,
        sprite.frameH,
        Math.round(effect.x - sprite.frameW / 2),
        Math.round(FEET_Y - effect.y - sprite.frameH),
        sprite.frameW,
        sprite.frameH
      );
      return true;
    });
  }

  // ------------------------------------------------------------------ fondo

  private drawBackground(state: RunnerState): void {
    const { ctx } = this;
    const sky = this.sprites.get('scene-sky');
    if (sky) {
      // La tira del cielo es de 4 px de ancho: se estira (todas sus columnas son iguales)
      ctx.drawImage(sky.image, 0, 0, sky.frameW, sky.frameH, 0, 0, this.width, GROUND_Y + 6);
    }

    // Las nubes avanzan lento y las colinas algo más: el paralaje da sensación de profundidad
    const clouds: [string, number, number][] = [['scene-cloud-0', 20, 0.06], ['scene-cloud-1', 52, 0.1]];
    for (const [name, y, speed] of clouds) {
      const cloud = this.sprites.get(name);
      if (cloud) {
        const span = this.width + cloud.frameW * 2;
        const x = ((((state.distance * speed + (name === 'scene-cloud-1' ? 120 : 0)) % span) + span) % span);
        ctx.drawImage(cloud.image, Math.round(this.width - x), y);
      }
    }

    // Un horizonte de piezas de ajedrez gigantes, muy lejos (lo que más tarda en pasar)
    const skyline = this.sprites.get('scene-skyline');
    if (skyline) {
      const offset = (state.distance * 0.1) % skyline.frameW;
      for (let x = -offset; x < this.width; x += skyline.frameW) {
        ctx.drawImage(skyline.image, Math.round(x), GROUND_Y - skyline.frameH + 14);
      }
    }

    const hills = this.sprites.get('scene-hills');
    if (hills) {
      const offset = (state.distance * 0.25) % hills.frameW;
      for (let x = -offset; x < this.width; x += hills.frameW) {
        ctx.drawImage(hills.image, Math.round(x), GROUND_Y - hills.frameH + 6);
      }
    }
  }

  private drawFloor(state: RunnerState): void {
    const { ctx } = this;
    const floor = this.sprites.get('scene-floor');
    if (!floor) {
      return;
    }
    const offset = state.distance % floor.frameW;
    for (let x = -offset; x < this.width; x += floor.frameW) {
      ctx.drawImage(floor.image, Math.round(x), GROUND_Y);
    }
    ctx.fillStyle = WOOD;
    ctx.fillRect(0, GROUND_Y + FLOOR_TILE_H, this.width, RUNNER_HEIGHT - GROUND_Y - FLOOR_TILE_H);
  }

  // ----------------------------------------------------------------- mundos y galletas

  /** El escenario cambia cada pocos niveles (tarde, noche, amanecer): se nota el avance sin leer un número. */
  private drawWorld(state: RunnerState): void {
    const world = worldOfLevel(state.difficulty.level);
    const tint = WORLD_TINT[world];
    if (!tint) {
      return;
    }
    const { ctx } = this;
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, this.width, GROUND_Y + 6);
    if (world === 'night') {
      STARS.forEach(([x, y], index) => {
        const twinkle = Math.floor(state.time * 2 + index) % 3 === 0;
        ctx.fillStyle = twinkle ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.95)';
        ctx.fillRect(Math.round(x * this.width), y, 1, 1);
      });
    }
  }

  private drawCookie(cookie: RunnerCookie, time: number): void {
    const { ctx } = this;
    const bob = Math.round(Math.sin(time * 5 + cookie.id) * 1);
    const left = Math.round(cookie.x);
    const top = Math.round(FEET_Y - cookie.y - COOKIE_SIZE) + bob;
    COOKIE_ART.forEach((row, dy) => {
      for (let dx = 0; dx < row.length; dx++) {
        const color = COOKIE_COLORS[row[dx]];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(left + dx, top + dy, 1, 1);
        }
      }
    });
  }

  // ------------------------------------------------------------- obstáculos

  private drawObstacle(obstacle: RunnerObstacle): void {
    const { ctx } = this;
    const image = this.pieces.get(pieceKey(obstacle.kind, obstacle.color));
    if (!image) {
      return;
    }
    const behavior = PIECE_BEHAVIOR[obstacle.kind];
    // La torre se desliza: una estela detrás para verla llegar
    if (behavior.slide > 1 && obstacle.x < this.width) {
      this.drawTrail(obstacle);
    }
    // La sombra se queda en el suelo aunque la pieza flote o salte
    const lifted = Math.max(0, obstacle.y);
    for (let i = 0; i < obstacle.count; i++) {
      const pieceX = obstacle.x + i * obstacle.spacing;
      const centerX = pieceX + (obstacle.width - (obstacle.count - 1) * obstacle.spacing) / 2;
      this.drawShadow(centerX, PIECE_DRAW_SIZE * 0.5, 1 - Math.min(0.5, lifted / 60));

      // Un obstáculo con el que ya se chocó se queda atrás, apagado
      ctx.globalAlpha = obstacle.hit ? 0.35 : 1;
      // El set de piezas es vectorial: se dibuja suavizado para que no salga con dientes de sierra
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(
        image,
        Math.round(centerX - PIECE_DRAW_SIZE / 2),
        Math.round(FEET_Y + PIECE_FOOT_PADDING - lifted - PIECE_DRAW_SIZE),
        PIECE_DRAW_SIZE,
        PIECE_DRAW_SIZE
      );
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = 1;
    }
  }

  /** Rayas de velocidad detrás de una pieza que se desliza. */
  private drawTrail(obstacle: RunnerObstacle): void {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    const baseY = FEET_Y - Math.round(obstacle.height / 2);
    for (let i = 0; i < 3; i++) {
      const length = 14 - i * 3;
      ctx.fillRect(Math.round(obstacle.x + obstacle.width + 2 + i * 2), baseY - 5 + i * 5, length, 1);
    }
  }

  /** Sombra elíptica sobre el suelo; más pequeña cuanto más alto está lo que la proyecta. */
  private drawShadow(centerX: number, width: number, scale: number): void {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(40, 24, 14, 0.28)';
    const w = Math.max(6, Math.round(width * scale));
    ctx.fillRect(Math.round(centerX - w / 2), FEET_Y + 1, w, 2);
    ctx.fillRect(Math.round(centerX - w / 2 + 2), FEET_Y + 3, Math.max(2, w - 4), 1);
  }

  // ---------------------------------------------------------------- Chocolate

  private dogSprite(state: RunnerState): { sprite: RunnerSprite | undefined; frame: number } {
    const { dog } = state;
    const airborne = dog.y > 0 || dog.vy > 0;
    const named = (name: string) => this.sprites.get(`dog-${name}`);
    const animated = (sprite: RunnerSprite | undefined) =>
      sprite ? Math.floor(state.time * sprite.fps) % sprite.frames : 0;
    // Corre al compás del suelo: más rápido el suelo, más rápidas las patas
    const stride = (sprite: RunnerSprite | undefined) =>
      sprite ? Math.floor(state.distance / STRIDE_PX) % sprite.frames : 0;

    if (dog.stumble > RUNNER_PHYSICS.stumbleTime - 0.5) {
      const sprite = named('hurt');
      return { sprite, frame: animated(sprite) };
    }
    if (state.phase === 'done') {
      const sprite = named('happy');
      return { sprite, frame: animated(sprite) };
    }
    if (airborne) {
      // Sube, en la cima y baja
      const frame = dog.vy > 120 ? 0 : dog.vy < -120 ? 2 : 1;
      return { sprite: named('jump'), frame };
    }
    const sprite = named('run');
    return { sprite, frame: state.phase === 'running' ? stride(sprite) : animated(sprite) };
  }

  private drawDog(state: RunnerState): void {
    const { ctx } = this;
    const { dog } = state;
    const { sprite, frame } = this.dogSprite(state);
    if (!sprite) {
      return;
    }

    this.drawShadow(dog.x + 2, 30, 1 - Math.min(0.6, dog.y / 120));

    // Mientras es invulnerable parpadea, para que se vea que no puede chocar
    const blinking = dog.stumble > 0 && Math.floor(dog.stumble * 12) % 2 === 0;
    ctx.globalAlpha = blinking ? 0.45 : 1;
    ctx.drawImage(
      sprite.image,
      frame * sprite.frameW,
      0,
      sprite.frameW,
      sprite.frameH,
      Math.round(dog.x - sprite.frameW / 2),
      Math.round(FEET_Y - dog.y - sprite.frameH),
      sprite.frameW,
      sprite.frameH
    );
    ctx.globalAlpha = 1;

    if (dog.stumble > RUNNER_PHYSICS.stumbleTime - 0.5) {
      this.drawStars(state, FEET_Y - dog.y - sprite.frameH);
    }
  }

  /** Tres estrellitas girando sobre la cabeza tras un tropiezo. */
  private drawStars(state: RunnerState, headY: number): void {
    const { ctx } = this;
    ctx.fillStyle = '#ffd24a';
    for (let i = 0; i < 3; i++) {
      const angle = state.time * 9 + (i * Math.PI * 2) / 3;
      const x = Math.round(state.dog.x + 4 + Math.cos(angle) * 14);
      const y = Math.round(headY + 6 + Math.sin(angle) * 4);
      ctx.fillRect(x - 1, y, 3, 1);
      ctx.fillRect(x, y - 1, 1, 3);
    }
  }
}
