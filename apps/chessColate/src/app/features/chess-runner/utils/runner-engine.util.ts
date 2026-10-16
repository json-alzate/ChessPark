/**
 * La simulación del Chess Runner: física del salto (y del doble salto), obstáculos, galletas y choques.
 * Pura y sin canvas ni reloj: `stepRun` avanza un instante y devuelve el estado nuevo y lo que ocurrió; así
 * se prueba con carreras guionizadas sin dibujar nada.
 *
 * Coordenadas en píxeles lógicos. En horizontal, de izquierda a derecha; en vertical, `y` es la altura
 * sobre el suelo (crece hacia arriba). Los obstáculos se mueven hacia la izquierda: es el suelo el que
 * pasa, Chocolate corre en el sitio.
 */

import {
  COOKIE_ARC_Y,
  COOKIE_HIGH_Y,
  COOKIE_SIZE,
  difficultyForLevel,
  DOG_BOX,
  FIRST_GAP,
  LUNGE_HOP,
  LUNGE_START,
  LUNGE_TIME,
  OBSTACLE_SHAPES,
  PIECE_BEHAVIOR,
  PX_PER_METER,
  RunnerDifficulty,
  RUNNER_PHYSICS as P,
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
/** Separación entre las galletas de una fila y alrededor de una pieza. */
const COOKIE_SPACING = 18;
/** Lo que se agranda la caja de Chocolate para coger galletas: es generoso. */
const PICKUP_REACH = { x: 4, y: 2 };

/** Dónde toca el frente de Chocolate: una pieza llega a él cuando su borde izquierdo pasa por aquí. */
export const CONTACT_X = P.dogX + DOG_BOX.dx + DOG_BOX.width;

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
  difficulty: RunnerDifficulty = difficultyForLevel(1)
): RunnerState {
  return {
    phase: 'running',
    time: 0,
    distance: 0,
    difficulty,
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
    finishing: false,
    done: false,
  };
}

const onGround = (dog: RunnerDog) => dog.y <= 0 && dog.vy <= 0;

/** Lo que de Chocolate puede chocar ahora mismo. */
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
 * Todas coinciden con el plan justo cuando llegan a Chocolate, así que la hora de saltar no cambia.
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
 * Un toque del jugador: Chocolate salta. En el aire, el segundo toque da el doble salto (si todavía sube,
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
        state: { ...state, dog: { ...dog, vy: P.doubleJumpVelocity, jumps: 2 } },
        jumped: true,
        double: true,
      };
    }
    return { state: { ...state, dog: { ...dog, doubleQueued: true } }, jumped: false, double: false };
  }
  return { state: { ...state, jumpBuffer: P.inputBuffer }, jumped: false, double: false };
}

/** Las galletas que acompañan a un obstáculo recién salido: un arco encima y, a veces, una fila en el suelo. */
function cookiesFor(
  obstacle: RunnerObstacle,
  gapPx: number,
  firstId: number
): { cookies: RunnerCookie[]; nextId: number } {
  const cookies: RunnerCookie[] = [];
  let nextId = firstId;
  const add = (x: number, y: number) => cookies.push({ id: nextId++, x, y });
  const center = obstacle.plan + obstacle.width / 2 - COOKIE_SIZE / 2;
  const beat = obstacle.beat ?? 0.5;

  if (obstacle.count > 1) {
    // Sobre una falange: arriba del todo, solo con el doble salto
    for (let i = -1; i <= 1; i++) {
      add(center + i * Math.max(COOKIE_SPACING, obstacle.width / 3), COOKIE_HIGH_Y);
    }
  } else {
    // Sobre la pieza: se cogen saltando con buen momento
    const y = Math.max(COOKIE_ARC_Y, obstacle.y + obstacle.height + 14);
    for (let i = -1; i <= 1; i++) {
      add(center + i * COOKIE_SPACING, y);
    }
  }
  if (beat <= 0.5 && gapPx > 0) {
    // Una fila a ras de suelo, a mitad del hueco: se coge corriendo, sin saltar
    const middle = obstacle.plan + obstacle.width + gapPx / 2 - COOKIE_SIZE / 2;
    for (let i = -1; i <= 1; i++) {
      add(middle + i * COOKIE_SPACING, 1);
    }
  }
  return { cookies, nextId };
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
      dog.vy = P.doubleJumpVelocity;
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
    const gapPx =
      queue.length > 0
        ? gapTimeAfter(state.difficulty, piece.beat) * state.speed +
          (count > 1 ? width + WALL_RECOVERY * state.speed : 0)
        : 0;
    untilSpawn = gapPx;
    const extra = cookiesFor(born, gapPx, nextId);
    nextId = extra.nextId;
    pickups = [...pickups, ...extra.cookies];
    obstacles.push(born);
  }

  // --- Choques y superados ----------------------------------------------------------------------
  let stumbles = state.stumbles;
  let cleared = state.cleared;
  let combo = state.combo;
  let bestCombo = state.bestCombo;
  const box = dogBox(dog);
  obstacles = obstacles.map((o) => {
    if (o.hit || o.cleared) {
      return o;
    }
    if (dog.stumble <= 0 && boxesOverlap(box, obstacleBox(o))) {
      stumbles++;
      dog.stumble = P.stumbleTime;
      combo = 0;
      events.stumbled = { ...o, hit: true };
      return { ...o, hit: true };
    }
    if (o.x + o.width < box.x0) {
      cleared++;
      combo++;
      bestCombo = Math.max(bestCombo, combo);
      const done = { ...o, cleared: true };
      events.cleared.push(done);
      return done;
    }
    return o;
  });
  obstacles = obstacles.filter((o) => o.x + o.width > DESPAWN_X);

  // --- Galletas ---------------------------------------------------------------------------------
  const reach: RunnerBox = {
    x0: box.x0 - PICKUP_REACH.x,
    x1: box.x1 + PICKUP_REACH.x,
    y0: box.y0 - PICKUP_REACH.y,
    y1: box.y1 + PICKUP_REACH.y,
  };
  const taken = pickups.filter((c) => boxesOverlap(reach, cookieBox(c)));
  pickups = pickups.filter((c) => !taken.includes(c) && c.x + COOKIE_SIZE > DESPAWN_X);
  events.cookies = taken.length;

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
    cleared,
    combo,
    bestCombo,
    cookies: state.cookies + taken.length,
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
  };
}
