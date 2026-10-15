import {
  DOG_BOX,
  OBSTACLE_SHAPES,
  RUNNER_CANVAS_HEIGHT,
  RUNNER_PHYSICS,
} from '../../config/runner.config';
import { RunnerObstacle, RunnerState } from '../../models/runner.model';
import { RunnerSprite } from '../../services/runner-sprites.service';
import { spriteName } from '../../utils/runner-sequence.util';

/** Medidas del lienzo lógico (el ancho depende de la pantalla; el alto es fijo). */
export const RUNNER_HEIGHT = RUNNER_CANVAS_HEIGHT;
/** Borde de arriba del tablero que hace de suelo. */
export const GROUND_Y = 142;
/** Donde apoyan los pies de Chocolate y la base de las piezas: en mitad de las casillas. */
export const FEET_Y = GROUND_Y + 8;

const FLOOR_TILE_H = 20;
const WOOD = '#3a2418';

type Sprites = ReadonlyMap<string, RunnerSprite>;

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
 * píxeles lógicos; quien lo crea fija la escala del lienzo y desactiva el suavizado.
 */
export class RunnerRenderer {
  private fx: ActiveFx[] = [];

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly sprites: Sprites,
    private width: number
  ) {}

  resize(width: number): void {
    this.width = width;
  }

  /** Suelta un efecto en (x, y): `y` es la altura sobre el suelo. */
  addFx(kind: RunnerFxKind, x: number, y: number, time: number): void {
    this.fx.push({ kind, x, y, start: time });
  }

  draw(state: RunnerState, options: { hints: boolean }): void {
    const { ctx } = this;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, this.width, RUNNER_HEIGHT);

    this.drawBackground(state);
    this.drawFloor(state);
    for (const obstacle of state.obstacles) {
      this.drawObstacle(obstacle);
    }
    this.drawFx(state);
    this.drawDog(state);
    if (options.hints) {
      this.drawHints(state);
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

  // ------------------------------------------------------------- obstáculos

  private drawObstacle(obstacle: RunnerObstacle): void {
    const { ctx } = this;
    const sprite = this.sprites.get(spriteName(obstacle.kind, obstacle.color));
    if (!sprite) {
      return;
    }
    const shape = OBSTACLE_SHAPES[obstacle.kind];
    const centerX = obstacle.x + shape.width / 2;

    this.drawShadow(centerX, sprite.frameW * 0.7, 1);

    // Un obstáculo con el que ya se chocó se queda atrás, apagado
    ctx.globalAlpha = obstacle.hit ? 0.35 : 1;
    ctx.drawImage(
      sprite.image,
      Math.round(centerX - sprite.frameW / 2),
      Math.round(FEET_Y - shape.bottom - sprite.frameH)
    );
    ctx.globalAlpha = 1;
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

    if (dog.stumble > RUNNER_PHYSICS.stumbleTime - 0.5) {
      const sprite = named('hurt');
      return { sprite, frame: animated(sprite) };
    }
    if (state.phase === 'done') {
      const sprite = named('happy');
      return { sprite, frame: animated(sprite) };
    }
    if (airborne) {
      // Sube, en la cima (o flotando) y baja
      const frame = dog.vy > 120 ? 0 : dog.vy < -120 ? 2 : 1;
      return { sprite: named('jump'), frame };
    }
    if (dog.slide > 0) {
      const sprite = named('slide');
      return { sprite, frame: animated(sprite) };
    }
    const sprite = named('run');
    return { sprite, frame: animated(sprite) };
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

  // ------------------------------------------------------------------ pistas

  private drawHints(state: RunnerState): void {
    const { ctx } = this;
    const box = state.dog.x + DOG_BOX.dx + DOG_BOX.width;

    for (const obstacle of state.obstacles) {
      if (obstacle.hit || obstacle.cleared) {
        continue;
      }
      const shape = OBSTACLE_SHAPES[obstacle.kind];
      const ahead = obstacle.x - box;
      // Solo cuando ya está en pantalla y aún falta para llegar
      if (ahead < 0 || obstacle.x > this.width - 4) {
        continue;
      }
      const hint = this.sprites.get(`hint-${shape.hint}`);
      if (hint) {
        const bob = Math.round(Math.sin(state.time * 6) * 2);
        ctx.drawImage(
          hint.image,
          Math.round(obstacle.x + shape.width / 2 - hint.frameW / 2),
          // La colita del globo apunta al obstáculo
          Math.round(FEET_Y - shape.bottom - shape.height - hint.frameH - 1 + bob)
        );
      }
      if (obstacle.kind === 'king' && ahead > 22 && ahead < 36) {
        this.drawTapNow(state);
      }
    }
  }

  /** El rey pide precisión: un aro en los pies de Chocolate marca el momento justo. */
  private drawTapNow(state: RunnerState): void {
    const { ctx } = this;
    const pulse = 0.55 + 0.45 * Math.abs(Math.sin(state.time * 20));
    ctx.strokeStyle = `rgba(255, 179, 71, ${pulse})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(state.dog.x - 16.5, FEET_Y - 2.5, 33, 5);
    ctx.strokeRect(state.dog.x - 14.5, FEET_Y - 1.5, 29, 3);
  }
}
