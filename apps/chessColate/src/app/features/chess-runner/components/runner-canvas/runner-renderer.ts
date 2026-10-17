import { COOKIE_SIZE, PIECE_BEHAVIOR, PIECE_DRAW_SIZE } from '../../config/runner.config';
import { CONTACT_X } from '../../utils/runner-engine.util';
import { COOKIE_ART, COOKIE_PALETTE, drawPixelArt, POWER_STAR_ART, POWER_STAR_PALETTE } from '../../rendering/pixel-art';
import { drawGround, drawScenery, FEET_Y, RUNNER_HEIGHT, Sprites } from '../../rendering/scenery';
import { RunnerPowerId, RunnerWorld } from '../../campaign/runner-curriculum';
import { drawDogGear } from '../../rendering/dog-gear';
import { drawPiece } from '../../rendering/stage';
import { RunnerCookie, RunnerObstacle, RunnerState } from '../../models/runner.model';
import { RunnerPieceSet } from '../../services/runner-pieces.service';
import { RunnerSprite } from '../../services/runner-sprites.service';
import { pieceKey } from '../../utils/runner-sequence.util';

export { FEET_Y, GROUND_Y, RUNNER_HEIGHT } from '../../rendering/scenery';

/** Lo que baja el cuadro de la pieza bajo el suelo: las piezas dejan un margen vacío abajo. */
const PIECE_FOOT_PADDING = 2;
/** Lo que dura la sacudida tras un tropiezo, en segundos. */
const SHAKE_TIME = 0.25;
/** Cuántos píxeles de suelo recorre el perrito entre un fotograma de su carrera y el siguiente. */
const STRIDE_PX = 11;


/** Un efecto breve (polvo, chispa) que se dibuja mientras dura su animación. */
export type RunnerFxKind = 'dust' | 'spark';

/** Un texto que sube y se desvanece (¡Perfecto!). */
interface Popup {
  text: string;
  x: number;
  y: number;
  color: string;
  start: number;
}

/** Una galleta que sale volando (de una pieza arrollada o de un choque) y cae. */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  start: number;
}

const POPUP_SECONDS = 0.9;
const PARTICLE_SECONDS = 0.9;
const PARTICLE_GRAVITY = 320;

interface ActiveFx {
  kind: RunnerFxKind;
  x: number;
  y: number;
  /** Segundo de la carrera en que nació. */
  start: number;
}

/**
 * Dibuja un instante del runner. No sabe de Angular ni del bucle: recibe el estado y pinta. Todo en
 * píxeles lógicos; quien lo crea fija la escala del lienzo. El perrito y el escenario son pixel art (sin
 * suavizado); las piezas son las del set que el usuario eligió para el tablero, que son vectoriales.
 */
export class RunnerRenderer {
  private fx: ActiveFx[] = [];
  private popups: Popup[] = [];
  private particles: Particle[] = [];
  /** El mundo en el que se corre: tiñe el escenario. */
  world: RunnerWorld = 'day';
  /** La pieza del jefe del capítulo (`bn`, `bk`…), que asoma al fondo al acabar la carrera; sin jefe, `null`. */
  boss: string | null = null;
  /** Lo que lleva puesto el perrito: los poderes que ha ganado. */
  gear: readonly RunnerPowerId[] = [];

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

  /** Un texto breve que sube desde (x, y) (`y` es la altura sobre el suelo). */
  addPopup(text: string, x: number, y: number, time: number, color = '#ffffff'): void {
    this.popups.push({ text, x, y, color, start: time });
  }

  /** Suelta `count` galletas que salen despedidas desde (x, y) y caen. */
  burst(count: number, x: number, y: number, time: number): void {
    for (let i = 0; i < count; i++) {
      const spread = count > 1 ? i / (count - 1) - 0.5 : 0;
      this.particles.push({ x, y, vx: spread * 120 + (i % 2 ? 8 : -8), vy: 85 + (i % 3) * 28, start: time });
    }
  }

  draw(state: RunnerState): void {
    const { ctx } = this;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, this.width, RUNNER_HEIGHT);

    // Un tropiezo sacude la escena un instante
    const shaking = state.dog.stumble > state.mods.stumbleTime - SHAKE_TIME;
    if (shaking) {
      ctx.save();
      const strength = (state.dog.stumble - (state.mods.stumbleTime - SHAKE_TIME)) / SHAKE_TIME;
      ctx.translate(Math.round(Math.sin(state.time * 90) * 2 * strength), Math.round(Math.cos(state.time * 70) * 1.5 * strength));
    }
    drawScenery(ctx, this.sprites, { width: this.width, distance: state.distance, time: state.time, world: this.world });
    drawGround(ctx, this.sprites, this.width, state.distance);
    this.drawBoss(state);
    for (const cookie of state.pickups) {
      if (cookie.kind === 'star') {
        this.drawPowerStar(cookie, state.time);
      } else {
        this.drawCookie(cookie, state.time);
      }
    }
    if (state.mods.ghosts) {
      this.drawGhosts(state);
    }
    for (const obstacle of state.obstacles) {
      this.drawObstacle(obstacle);
    }
    this.drawFx(state);
    if (state.starTime > 0) {
      this.drawStarAura(state);
    }
    this.drawDog(state);
    this.drawParticles(state);
    this.drawPopups(state);
    if (state.mods.tapCue) {
      this.drawTapCue(state);
    }
    if (state.shields > 0) {
      this.drawShield(state);
    }
    this.drawSpeedLines(state);
    if (shaking) {
      ctx.restore();
    }
  }

  /**
   * El jefe del capítulo: al pasar de los dos tercios de la carrera, el guardián (una pieza oscura enorme) asoma por el
   * borde derecho y se planta al fondo, con los ojos encendidos, esperando al perrito.
   */
  private drawBoss(state: RunnerState): void {
    const image = this.boss ? this.pieces.get(this.boss) : null;
    if (!image) {
      return;
    }
    const progress = state.total > 0 ? state.cleared / state.total : 0;
    const arrive = Math.min(Math.max((progress - 0.66) / 0.3, 0), 1);
    if (arrive <= 0 && state.phase === 'running') {
      return;
    }
    const eased = arrive * arrive * (3 - 2 * arrive);
    const size = Math.round(PIECE_DRAW_SIZE * 2.6);
    const x = this.width + size / 2 - eased * (size * 0.85);
    drawPiece(this.ctx, image, x, 0, size, { shadow: true, eyes: 0.4 + 0.6 * eased, alpha: 0.9 });
  }

  /**
   * El poder del fantasma: donde llegará de verdad una pieza que se desliza o salta (es el sitio donde estaría si fuera quieta),
   * como una silueta tenue en el suelo. Se salta cuando la pieza llega a su fantasma.
   */
  private drawGhosts(state: RunnerState): void {
    const { ctx } = this;
    for (const obstacle of state.obstacles) {
      const behavior = PIECE_BEHAVIOR[obstacle.kind];
      if (obstacle.hit || obstacle.cleared || (behavior.slide <= 1 && behavior.lunge <= 0)) {
        continue;
      }
      const image = this.pieces.get(pieceKey(obstacle.kind, obstacle.color));
      if (!image || obstacle.plan > this.width) {
        continue;
      }
      const centerX = obstacle.plan + obstacle.width / 2;
      ctx.globalAlpha = 0.28;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(
        image,
        Math.round(centerX - PIECE_DRAW_SIZE / 2),
        Math.round(FEET_Y + PIECE_FOOT_PADDING - behavior.lift - PIECE_DRAW_SIZE),
        PIECE_DRAW_SIZE,
        PIECE_DRAW_SIZE
      );
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = 1;
    }
  }

  /**
   * El poder de la huella: un destello bajo las patas cuando es buen momento de tocar para la siguiente pieza (según la
   * hora a la que llega de verdad, no donde se ve).
   */
  private drawTapCue(state: RunnerState): void {
    const next = state.obstacles.find((o) => !o.hit && !o.cleared && o.plan > CONTACT_X - 4);
    if (!next || state.dog.y > 0) {
      return;
    }
    const toContact = (next.plan - CONTACT_X) / Math.max(state.speed, 1);
    if (toContact < 0.1 || toContact > 0.3) {
      return;
    }
    const { ctx } = this;
    const strength = 1 - Math.abs(toContact - 0.2) / 0.1;
    ctx.fillStyle = `rgba(255, 255, 255, ${(0.35 + 0.5 * Math.max(0, strength)).toFixed(2)})`;
    const x = Math.round(state.dog.x);
    ctx.fillRect(x - 12, FEET_Y + 2, 24, 1);
    ctx.fillRect(x - 8, FEET_Y + 4, 16, 1);
    ctx.fillRect(x - 4, FEET_Y + 6, 8, 1);
  }

  /** El escudo: una burbuja azul y translúcida alrededor del perrito mientras no se ha gastado. */
  private drawShield(state: RunnerState): void {
    const { ctx } = this;
    const cx = state.dog.x;
    const cy = FEET_Y - state.dog.y - 18;
    const wobble = Math.sin(state.time * 6) * 0.6;
    ctx.fillStyle = 'rgba(90, 160, 255, 0.16)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 31 + wobble, 25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(150, 205, 255, 0.85)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 31 + wobble, 25, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillRect(Math.round(cx - 20), Math.round(cy - 14), 3, 2);
    ctx.fillRect(Math.round(cx - 17), Math.round(cy - 17), 2, 2);
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

  // ----------------------------------------------------------------- galletas

  private drawCookie(cookie: RunnerCookie, time: number): void {
    const bob = Math.round(Math.sin(time * 5 + cookie.id) * 1);
    drawPixelArt(
      this.ctx,
      COOKIE_ART,
      COOKIE_PALETTE,
      Math.round(cookie.x),
      Math.round(FEET_Y - cookie.y - COOKIE_SIZE) + bob
    );
  }

  /** La estrella: gira un poco (late) y brilla. */
  private drawPowerStar(cookie: RunnerCookie, time: number): void {
    const { ctx } = this;
    const pulse = 0.5 + 0.5 * Math.sin(time * 6);
    const cx = Math.round(cookie.x + COOKIE_SIZE / 2);
    const cy = Math.round(FEET_Y - cookie.y - COOKIE_SIZE / 2);
    ctx.fillStyle = `rgba(255, 220, 90, ${(0.16 + 0.14 * pulse).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(cx, cy, 8 + pulse * 2, 0, Math.PI * 2);
    ctx.fill();
    drawPixelArt(ctx, POWER_STAR_ART, POWER_STAR_PALETTE, Math.round(cookie.x), Math.round(FEET_Y - cookie.y - COOKIE_SIZE) + Math.round(Math.sin(time * 5) * 1));
  }

  /** Mientras dura la estrella: un resplandor dorado que parpadea al acabarse, chispas y una barrita de lo que queda. */
  private drawStarAura(state: RunnerState): void {
    const { ctx } = this;
    const { dog } = state;
    // Parpadea en el último segundo para avisar de que se acaba
    if (state.starTime < 1 && Math.floor(state.time * 10) % 2 === 0) {
      return;
    }
    const cx = Math.round(dog.x + 2);
    const cy = Math.round(FEET_Y - dog.y - 14);
    const pulse = 0.5 + 0.5 * Math.sin(state.time * 14);
    ctx.fillStyle = `rgba(255, 210, 74, ${(0.2 + 0.15 * pulse).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(cx, cy, 24 + pulse * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 245, 190, 0.35)';
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3b0';
    for (let i = 0; i < 4; i++) {
      const angle = state.time * 7 + (i * Math.PI) / 2;
      ctx.fillRect(Math.round(cx + Math.cos(angle) * 22), Math.round(cy + Math.sin(angle) * 14), 2, 2);
    }
    // Lo que queda de estrella
    const left = Math.min(1, state.starTime / 4);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(cx - 12, cy - 34, 24, 3);
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(cx - 12, cy - 34, Math.round(24 * left), 3);
  }

  private drawParticles(state: RunnerState): void {
    const { ctx } = this;
    this.particles = this.particles.filter((p) => {
      const age = state.time - p.start;
      if (age > PARTICLE_SECONDS) {
        return false;
      }
      const y = Math.max(0, p.y + p.vy * age - 0.5 * PARTICLE_GRAVITY * age * age);
      // Se lleva el suelo (que pasa a la velocidad de la carrera) y se apaga al final
      const x = p.x + p.vx * age - state.speed * age * 0.6;
      ctx.globalAlpha = age > PARTICLE_SECONDS * 0.7 ? Math.max(0, 1 - (age - PARTICLE_SECONDS * 0.7) / (PARTICLE_SECONDS * 0.3)) : 1;
      drawPixelArt(ctx, COOKIE_ART, COOKIE_PALETTE, Math.round(x - COOKIE_SIZE / 2), Math.round(FEET_Y - y - COOKIE_SIZE));
      ctx.globalAlpha = 1;
      return true;
    });
  }

  private drawPopups(state: RunnerState): void {
    const { ctx } = this;
    this.popups = this.popups.filter((popup) => {
      const age = (state.time - popup.start) / POPUP_SECONDS;
      if (age >= 1) {
        return false;
      }
      ctx.save();
      ctx.globalAlpha = Math.min(1, 2.2 * (1 - age));
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(40, 20, 0, 0.85)';
      const x = Math.round(Math.min(Math.max(popup.x, 30), this.width - 30));
      const y = Math.round(FEET_Y - popup.y - 14 * age);
      ctx.strokeText(popup.text, x, y);
      ctx.fillStyle = popup.color;
      ctx.fillText(popup.text, x, y);
      ctx.restore();
      return true;
    });
  }

  // ------------------------------------------------------------- obstáculos

  private drawObstacle(obstacle: RunnerObstacle): void {
    // Lo que arrolló el perrito con la estrella ya no está
    if (obstacle.smashed) {
      return;
    }
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

  // ------------------------------------------------------------------ el perrito

  private dogSprite(state: RunnerState): { sprite: RunnerSprite | undefined; frame: number } {
    const { dog } = state;
    const airborne = dog.y > 0 || dog.vy > 0;
    const named = (name: string) => this.sprites.get(`dog-${name}`);
    const animated = (sprite: RunnerSprite | undefined) =>
      sprite ? Math.floor(state.time * sprite.fps) % sprite.frames : 0;
    // Corre al compás del suelo: más rápido el suelo, más rápidas las patas
    const stride = (sprite: RunnerSprite | undefined) =>
      sprite ? Math.floor(state.distance / STRIDE_PX) % sprite.frames : 0;

    if (dog.stumble > state.mods.stumbleTime - 0.5) {
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
    // Lo que lleva puesto por los patrones dominados (solo si corre: en el tropiezo y la meta el sprite cambia de forma)
    if (this.gear.length > 0 && (sprite === this.sprites.get('dog-run') || sprite === this.sprites.get('dog-jump'))) {
      drawDogGear(ctx, this.gear, Math.round(dog.x - sprite.frameW / 2), Math.round(FEET_Y - dog.y - sprite.frameH), {
        time: state.time,
        airborne: dog.y > 0,
      });
    }
    ctx.globalAlpha = 1;

    if (dog.stumble > state.mods.stumbleTime - 0.5) {
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
