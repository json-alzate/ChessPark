/**
 * La simulación del Chess Runner: física del salto (y del doble salto), obstáculos, galletas y choques.
 * Pura y sin canvas ni reloj: `stepRun` avanza un instante y devuelve el estado nuevo y lo que ocurrió; así
 * se prueba con carreras guionizadas sin dibujar nada.
 *
 * Coordenadas en píxeles lógicos. En horizontal, de izquierda a derecha; en vertical, `y` es la altura
 * sobre el suelo (crece hacia arriba). Los obstáculos se mueven hacia la izquierda: es el suelo el que
 * pasa, el perrito corre en el sitio.
 */

import { BASE_MODIFIERS, RunnerModifiers } from '../config/runner-powers';
import {
  COOKIE_SIZE,
  difficultyForLevel,
  DOG_BOX,
  FIRST_GAP,
  LUNGE_HOP,
  LUNGE_START,
  LUNGE_TIME,
  OBSTACLE_SHAPES,
  PERFECT_COOKIES,
  PERFECT_RATIO,
  PIECE_BEHAVIOR,
  PX_PER_METER,
  RunnerDifficulty,
  RUNNER_PHYSICS as P,
  SMASH_COOKIES,
  STAR_SECONDS,
  WALL_COUNT,
  WALL_MIN_SPACING,
} from '../config/runner.config';
import {
  RunnerBox,
  RunnerCookie,
  RunnerDog,
  RunnerEvents,
  RunnerObstacle,
  RunnerPiece,
  RunnerPieceKind,
  RunnerState,
  RunnerStats,
} from '../models/runner.model';
import { cookiesFor } from './runner-cookies.util';

/** Cuánto más allá del borde derecho sale un obstáculo nuevo. */
const SPAWN_MARGIN = 10;
/** Ya fuera de pantalla por la izquierda: se descarta. */
const DESPAWN_X = -90;
/** Lo rápido que alcanza el suelo su velocidad nueva al superar una pieza (1/s): sube suave, sin tirón. */
const SPEED_EASING = 2.5;
/** Un segundo toque dado mientras sube espera a la cima: a esta velocidad vertical o menos se ejecuta. */
const DOUBLE_AT_VY = 30;
/** Holgura, en píxeles, con que se separa una falange para que un salto sencillo no la salve. */
const WALL_MARGIN = 6;
/** Tras una falange el doble salto aterriza más lejos: se deja este tiempo extra (s) antes de la siguiente pieza. */
const WALL_RECOVERY = 0.35;
/** Lo que dura la invulnerabilidad cuando el escudo aguanta un choque. */
const SHIELD_GRACE = 0.6;

/** Dónde toca el frente del perrito: una pieza llega a él cuando su borde izquierdo pasa por aquí. */
export const CONTACT_X = P.dogX + DOG_BOX.dx + DOG_BOX.width;

/** La altura que tiene que alcanzar el perrito al cruzar una pieza para que el salto sea perfecto. */
export function perfectHeight(obstacle: Pick<RunnerObstacle, 'count'>, mods: Pick<RunnerModifiers, 'doubleJumpVelocity'>): number {
  const single = P.jumpVelocity ** 2 / (2 * P.gravity);
  // Las falanges piden el doble salto: lo más alto es la cima del segundo
  const peak = obstacle.count > 1 ? single + mods.doubleJumpVelocity ** 2 / (2 * P.gravity) : single;
  return peak * PERFECT_RATIO;
}

/** Hueco, en segundos de carrera, que sigue a una pieza: el ritmo de cada una dentro del nivel. */
export function gapTimeAfter(difficulty: RunnerDifficulty, beat: number | undefined): number {
  const t = Math.min(Math.max(beat ?? 0.5, 0), 1);
  return difficulty.minGapTime + (difficulty.maxGapTime - difficulty.minGapTime) * t;
}

/** Velocidad a la que debe ir el suelo con tantas piezas superadas: sube de `startSpeed` a `endSpeed`. */
function targetSpeed(difficulty: RunnerDifficulty, cleared: number, total: number): number {
  const progress = total > 0 ? Math.min(cleared / total, 1) : 1;
  return difficulty.startSpeed + (difficulty.endSpeed - difficulty.startSpeed) * progress;
}

/** Cuánto tiempo (s) pasa un salto sencillo por encima de algo de esa altura. */
export function airTimeAbove(height: number): number {
  const rest = P.jumpVelocity ** 2 - 2 * P.gravity * height;
  return rest <= 0 ? 0 : (2 * Math.sqrt(rest)) / P.gravity;
}

/**
 * Separación entre las piezas de una falange a esa velocidad: la justa para que un salto sencillo no pueda
 * pasar por encima de todas (hay que hacer el doble salto) y, a la vez, uno doble sí.
 */
export function wallSpacing(kind: RunnerPieceKind, speed: number): number {
  const shape = OBSTACLE_SHAPES[kind];
  const top = PIECE_BEHAVIOR[kind].lift + shape.height;
  const reach = speed * airTimeAbove(top);
  const spacing = Math.ceil((reach + WALL_MARGIN - shape.width - DOG_BOX.width) / (WALL_COUNT - 1)) + 2;
  return Math.max(WALL_MIN_SPACING, spacing);
}

export function createRun(
  sequence: RunnerPiece[],
  width: number,
  difficulty: RunnerDifficulty = difficultyForLevel(1),
  mods: RunnerModifiers = BASE_MODIFIERS
): RunnerState {
  return {
    phase: 'running',
    time: 0,
    distance: 0,
    difficulty,
    mods,
    shields: mods.shields,
    speed: difficulty.startSpeed,
    width,
    dog: {
      x: P.dogX,
      y: 0,
      vy: 0,
      stumble: 0,
      jumps: 0,
      doubleQueued: false,
    },
    obstacles: [],
    pickups: [],
    queue: [...sequence],
    untilSpawn: FIRST_GAP,
    nextId: 1,
    jumpBuffer: 0,
    total: sequence.length,
    cleared: 0,
    stumbles: 0,
    combo: 0,
    bestCombo: 0,
    cookies: 0,
    starTime: 0,
    starSpawned: false,
    starsTaken: 0,
    perfects: 0,
    smashed: 0,
  };
}

export function noEvents(): RunnerEvents {
  return {
    jumped: false,
    doubleJumped: false,
    landed: false,
    cookies: 0,
    cleared: [],
    stumbled: null,
    shielded: null,
    perfect: [],
    starTaken: false,
    smashed: [],
    starEnded: false,
    finishing: false,
    done: false,
  };
}

const onGround = (dog: RunnerDog) => dog.y <= 0 && dog.vy <= 0;

/** Lo que del perrito puede chocar ahora mismo. */
export function dogBox(dog: RunnerDog): RunnerBox {
  const x0 = dog.x + DOG_BOX.dx;
  return {
    x0,
    x1: x0 + DOG_BOX.width,
    y0: dog.y,
    y1: dog.y + DOG_BOX.height,
  };
}

export function obstacleBox(
  obstacle: Pick<RunnerObstacle, 'x' | 'y' | 'width' | 'height'>
): RunnerBox {
  return {
    x0: obstacle.x,
    x1: obstacle.x + obstacle.width,
    y0: obstacle.y,
    y1: obstacle.y + obstacle.height,
  };
}

export function cookieBox(cookie: Pick<RunnerCookie, 'x' | 'y'>): RunnerBox {
  return { x0: cookie.x, x1: cookie.x + COOKIE_SIZE, y0: cookie.y, y1: cookie.y + COOKIE_SIZE };
}

export function boxesOverlap(a: RunnerBox, b: RunnerBox): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

/**
 * Coloca una pieza según su `plan` (donde estaría si fuera quieta) y su forma de moverse: la torre se
 * acerca más rápido, el caballo y la dama avanzan de un salto en L poco antes de llegar y el alfil flota.
 * Todas coinciden con el plan justo cuando llegan al perrito, así que la hora de saltar no cambia.
 */
export function placeObstacle(obstacle: RunnerObstacle, speed: number): RunnerObstacle {
  const behavior = PIECE_BEHAVIOR[obstacle.kind];
  const ahead = obstacle.plan - CONTACT_X;
  let x = CONTACT_X + behavior.slide * ahead;
  let hop = 0;
  if (behavior.lunge > 0 && ahead > 0) {
    const toContact = ahead / Math.max(speed, 1);
    const progress = Math.min(Math.max((LUNGE_START - toContact) / LUNGE_TIME, 0), 1);
    x += behavior.lunge * (1 - progress);
    hop = progress > 0 && progress < 1 ? LUNGE_HOP * Math.sin(Math.PI * progress) : 0;
  }
  return { ...obstacle, x, y: behavior.lift + hop };
}

/**
 * Un toque del jugador: el perrito salta. En el aire, el segundo toque da el doble salto (si todavía sube,
 * espera a la cima, así que dos toques seguidos siempre salen bien). Un tercero, o uno dado cuando ya no
 * queda salto, se guarda si falta un instante para aterrizar y se hace al tocar el suelo.
 */
export function jump(state: RunnerState): {
  state: RunnerState;
  jumped: boolean;
  double: boolean;
} {
  if (state.phase !== 'running') {
    return { state, jumped: false, double: false };
  }
  const { dog } = state;
  if (onGround(dog)) {
    return {
      state: { ...state, dog: { ...dog, vy: P.jumpVelocity, jumps: 1 }, jumpBuffer: 0 },
      jumped: true,
      double: false,
    };
  }
  if (dog.jumps === 1 && !dog.doubleQueued) {
    if (dog.vy <= DOUBLE_AT_VY) {
      return {
        state: { ...state, dog: { ...dog, vy: state.mods.doubleJumpVelocity, jumps: 2 } },
        jumped: true,
        double: true,
      };
    }
    return { state: { ...state, dog: { ...dog, doubleQueued: true } }, jumped: false, double: false };
  }
  return { state: { ...state, jumpBuffer: state.mods.inputBuffer }, jumped: false, double: false };
}

/** Avanza `dt` segundos. */
export function stepRun(
  previous: RunnerState,
  dt: number
): { state: RunnerState; events: RunnerEvents } {
  const events = noEvents();
  if (previous.phase === 'done') {
    return { state: previous, events };
  }

  let state: RunnerState = { ...previous, time: previous.time + dt };
  const dog: RunnerDog = { ...state.dog };

  dog.stumble = Math.max(0, dog.stumble - dt);

  // --- Vertical ---------------------------------------------------------------------------------
  if (!onGround(dog)) {
    dog.vy -= P.gravity * dt;
    dog.y += dog.vy * dt;
    if (dog.doubleQueued && dog.vy <= DOUBLE_AT_VY) {
      // El segundo toque se dio subiendo: en la cima, el segundo impulso
      dog.vy = state.mods.doubleJumpVelocity;
      dog.jumps = 2;
      dog.doubleQueued = false;
      events.jumped = true;
      events.doubleJumped = true;
    }
    if (dog.y <= 0) {
      dog.y = 0;
      dog.vy = 0;
      dog.jumps = 0;
      dog.doubleQueued = false;
      events.landed = true;
    }
  }

  // --- El suelo pasa (y cada vez más rápido) ------------------------------------------------------
  if (state.phase === 'running') {
    const target = targetSpeed(state.difficulty, state.cleared, state.total);
    state.speed += (target - state.speed) * Math.min(1, SPEED_EASING * dt);
  }
  const scroll = state.speed * dt;
  let obstacles = state.obstacles.map((o) =>
    placeObstacle({ ...o, plan: o.plan - scroll }, state.speed)
  );
  let pickups = state.pickups.map((c) => ({ ...c, x: c.x - scroll }));
  let queue = state.queue;
  let untilSpawn = state.untilSpawn - scroll;
  let nextId = state.nextId;

  // --- Salen los obstáculos ---------------------------------------------------------------------
  if (state.phase === 'running' && queue.length > 0 && untilSpawn <= 0) {
    const piece = queue[0];
    const shape = OBSTACLE_SHAPES[piece.kind];
    const count = (piece.wall ?? 1) > 1 ? WALL_COUNT : 1;
    // Con el suelo todavía acelerando, la falange se separa para la velocidad a la que llegará
    const spacing = count > 1 ? wallSpacing(piece.kind, state.speed * 1.04) : 0;
    const width = (count - 1) * spacing + shape.width;
    const born = placeObstacle(
      {
        id: nextId++,
        kind: piece.kind,
        color: piece.color,
        beat: piece.beat,
        plan: state.width + SPAWN_MARGIN,
        x: 0,
        y: 0,
        width,
        height: shape.height,
        count,
        spacing,
        cleared: false,
        hit: false,
      },
      state.speed
    );
    queue = queue.slice(1);
    const restPx = queue.length > 0 ? (piece.rest ?? 0) * state.speed : 0;
    const gapPx =
      queue.length > 0
        ? gapTimeAfter(state.difficulty, piece.beat) * state.speed +
          (count > 1 ? width + WALL_RECOVERY * state.speed : 0) +
          restPx
        : 0;
    untilSpawn = gapPx;
    // La estrella sale en el primer respiro de la carrera
    const star = restPx > 0 && !state.starSpawned;
    const extra = cookiesFor(born, gapPx, nextId, restPx, gapPx / state.speed, star);
    nextId = extra.nextId;
    pickups = [...pickups, ...extra.cookies];
    state.starSpawned = state.starSpawned || star;
    obstacles.push(born);
  }

  // --- Choques y superados ----------------------------------------------------------------------
  let stumbles = state.stumbles;
  let cleared = state.cleared;
  let combo = state.combo;
  let bestCombo = state.bestCombo;
  let shields = state.shields;
  let perfects = state.perfects;
  let smashed = state.smashed;
  let bonus = 0;
  const starting = state.starTime > 0;
  const box = dogBox(dog);
  obstacles = obstacles.map((o) => {
    if (o.hit || o.cleared) {
      return o;
    }
    if (starting && boxesOverlap(box, obstacleBox(o))) {
      // Con la estrella el perrito arrolla lo que toca: cuenta como pieza superada y suelta galletas
      cleared++;
      combo++;
      smashed++;
      bonus += SMASH_COOKIES;
      bestCombo = Math.max(bestCombo, combo);
      const done = { ...o, cleared: true, smashed: true };
      events.cleared.push(done);
      events.smashed.push(done);
      return done;
    }
    if (dog.stumble <= 0 && boxesOverlap(box, obstacleBox(o))) {
      if (shields > 0) {
        // El escudo aguanta el golpe: ni corazón ni racha perdidos, y un respiro para seguir
        shields--;
        dog.stumble = SHIELD_GRACE;
        events.shielded = { ...o, hit: true };
        return { ...o, hit: true };
      }
      stumbles++;
      dog.stumble = state.mods.stumbleTime;
      combo = 0;
      events.stumbled = { ...o, hit: true };
      return { ...o, hit: true };
    }
    let current = o;
    // Al cruzar el centro de la pieza con el del perrito se ve si va en lo más alto del salto
    if (!o.judged && o.x + o.width / 2 <= dog.x) {
      const perfect = dog.y >= perfectHeight(o, state.mods);
      current = { ...o, judged: true, perfect };
      if (perfect) {
        perfects++;
        bonus += PERFECT_COOKIES;
        events.perfect.push(current);
      }
    }
    if (current.x + current.width < box.x0) {
      cleared++;
      combo++;
      bestCombo = Math.max(bestCombo, combo);
      const done = { ...current, cleared: true };
      events.cleared.push(done);
      return done;
    }
    return current;
  });
  obstacles = obstacles.filter((o) => o.x + o.width > DESPAWN_X);

  // --- Galletas y la estrella ---------------------------------------------------------------------
  const reach: RunnerBox = {
    x0: box.x0 - state.mods.pickupReachX,
    x1: box.x1 + state.mods.pickupReachX,
    y0: box.y0 - state.mods.pickupReachY,
    y1: box.y1 + state.mods.pickupReachY,
  };
  const taken = pickups.filter((c) => boxesOverlap(reach, cookieBox(c)));
  pickups = pickups.filter((c) => !taken.includes(c) && c.x + COOKIE_SIZE > DESPAWN_X);
  const gotStar = taken.some((c) => c.kind === 'star');
  const cookiesTaken = taken.filter((c) => c.kind !== 'star').length + bonus;
  events.cookies = cookiesTaken;
  events.starTaken = gotStar;
  let starTime = Math.max(0, state.starTime - dt);
  if (starTime === 0 && state.starTime > 0) {
    events.starEnded = true;
  }
  if (gotStar) {
    starTime = STAR_SECONDS;
  }

  // --- Fin del recorrido ------------------------------------------------------------------------
  let phase = state.phase;
  if (phase === 'running' && queue.length === 0 && obstacles.every((o) => o.hit || o.cleared)) {
    phase = 'finishing';
    events.finishing = true;
  }
  if (phase === 'finishing') {
    dog.x += P.finishSpeed * dt;
    if (dog.x > state.width + 30) {
      phase = 'done';
      events.done = true;
    }
  }

  state = {
    ...state,
    distance: state.distance + scroll,
    phase,
    dog,
    obstacles,
    pickups,
    queue,
    untilSpawn,
    nextId,
    stumbles,
    shields,
    cleared,
    combo,
    bestCombo,
    perfects,
    smashed,
    starTime,
    starsTaken: state.starsTaken + (gotStar ? 1 : 0),
    cookies: state.cookies + cookiesTaken,
  };

  // --- Un toque guardado se salta al aterrizar --------------------------------------------------
  if (state.jumpBuffer > 0) {
    const left = state.jumpBuffer - dt;
    if (left <= 0) {
      state = { ...state, jumpBuffer: 0 };
    } else if (onGround(state.dog) && state.phase === 'running') {
      const result = jump({ ...state, jumpBuffer: 0 });
      state = result.state;
      events.jumped = events.jumped || result.jumped;
    } else {
      state = { ...state, jumpBuffer: left };
    }
  }

  return { state, events };
}

/** Los metros que lleva corridos una carrera. */
export function metersOf(state: Pick<RunnerState, 'distance'>): number {
  return Math.floor(state.distance / PX_PER_METER);
}

/** Lo que se cuenta al terminar la carrera. */
export function runnerStats(state: RunnerState): RunnerStats {
  return {
    total: state.total,
    stumbles: state.stumbles,
    clean: state.stumbles === 0,
    durationMs: Math.round(state.time * 1000),
    bestCombo: state.bestCombo,
    meters: metersOf(state),
    cookies: state.cookies,
    perfects: state.perfects,
    smashed: state.smashed,
  };
}
