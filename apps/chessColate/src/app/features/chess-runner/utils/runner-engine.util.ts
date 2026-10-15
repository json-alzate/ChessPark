/**
 * La simulación del Chess Runner: física del salto, obstáculos, colisiones y reintentos. Pura y sin
 * canvas ni reloj: `stepRun` avanza un instante y devuelve el estado nuevo y lo que ocurrió; así se
 * prueba con carreras guionizadas sin dibujar nada.
 *
 * Coordenadas en píxeles lógicos. En horizontal, de izquierda a derecha; en vertical, `y` es la altura
 * sobre el suelo (crece hacia arriba). Los obstáculos se mueven hacia la izquierda: es el suelo el que
 * pasa, Chocolate corre en el sitio.
 */

import {
  DOG_BOX,
  FIRST_GAP,
  OBSTACLE_SHAPES,
  RUNNER_PHYSICS as P,
} from '../config/runner.config';
import {
  RunnerAction,
  RunnerBox,
  RunnerDog,
  RunnerEvents,
  RunnerObstacle,
  RunnerPiece,
  RunnerState,
  RunnerStats,
} from '../models/runner.model';

/** Cuánto más allá del borde derecho sale un obstáculo nuevo. */
const SPAWN_MARGIN = 10;
/** Ya fuera de pantalla por la izquierda: se descarta. */
const DESPAWN_X = -70;

export function createRun(sequence: RunnerPiece[], width: number): RunnerState {
  return {
    phase: 'running',
    time: 0,
    distance: 0,
    width,
    dog: {
      x: P.dogX,
      y: 0,
      vy: 0,
      jumps: 0,
      hoverLeft: 0,
      longJump: false,
      slide: 0,
      stumble: 0,
    },
    obstacles: [],
    queue: sequence.map((piece) => ({ piece, attempt: 0 })),
    untilSpawn: FIRST_GAP,
    nextId: 1,
    buffer: null,
    total: sequence.length,
    cleared: 0,
    stumbles: 0,
  };
}

export function noEvents(): RunnerEvents {
  return {
    jumped: false,
    doubleJumped: false,
    landed: false,
    cleared: [],
    stumbled: null,
    finishing: false,
    done: false,
  };
}

const onGround = (dog: RunnerDog) => dog.y <= 0 && dog.vy <= 0;

/** Lo que de Chocolate puede chocar ahora mismo (agachado es mucho más bajo). */
export function dogBox(dog: RunnerDog): RunnerBox {
  const sliding = dog.slide > 0 && onGround(dog);
  const x0 = dog.x + DOG_BOX.dx;
  return {
    x0,
    x1: x0 + DOG_BOX.width,
    y0: dog.y,
    y1: dog.y + (sliding ? DOG_BOX.slideHeight : DOG_BOX.height),
  };
}

export function obstacleBox(obstacle: Pick<RunnerObstacle, 'kind' | 'x'>): RunnerBox {
  const shape = OBSTACLE_SHAPES[obstacle.kind];
  return {
    x0: obstacle.x,
    x1: obstacle.x + shape.width,
    y0: shape.bottom,
    y1: shape.bottom + shape.height,
  };
}

export function boxesOverlap(a: RunnerBox, b: RunnerBox): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

/**
 * Ejecuta una orden del jugador. Devuelve el estado nuevo y qué pasó. Lo que no se puede hacer ahora
 * (saltar sin más saltos, agacharse en el aire) se guarda un instante y se hace al aterrizar.
 */
export function perform(
  state: RunnerState,
  action: RunnerAction
): { state: RunnerState; jumped: boolean; doubleJumped: boolean } {
  if (state.phase !== 'running') {
    return { state, jumped: false, doubleJumped: false };
  }
  const dog = { ...state.dog };
  let jumped = false;
  let doubleJumped = false;
  let buffer = state.buffer;

  if (onGround(dog)) {
    if (action === 'slide') {
      dog.slide = P.slideTime;
    } else {
      // Un salto cancela el agache: no se puede estar en las dos cosas
      dog.slide = 0;
      dog.vy = P.jumpVelocity;
      dog.jumps = 1;
      dog.longJump = action === 'longJump';
      dog.hoverLeft = action === 'jump' ? P.hoverMax : 0;
      jumped = true;
    }
    buffer = null;
  } else if (action === 'jump' && dog.jumps === 1 && !dog.longJump) {
    // Segundo impulso en el aire: el doble salto de la dama
    dog.vy = P.doubleJumpVelocity;
    dog.jumps = 2;
    dog.hoverLeft = 0;
    doubleJumped = true;
  } else if (action === 'slide') {
    // En el aire, agacharse es caer en picado; y al tocar el suelo sigue agachado
    dog.vy = Math.min(dog.vy, -P.diveVelocity);
    buffer = { action: 'slide', ttl: P.inputBuffer };
  } else {
    buffer = { action, ttl: P.inputBuffer };
  }

  return { state: { ...state, dog, buffer }, jumped, doubleJumped };
}

/**
 * Avanza `dt` segundos. `holding` es si el jugador mantiene pulsado: en la cima, mantener hace que
 * Chocolate se quede flotando (lo que necesita el caballo).
 */
export function stepRun(
  previous: RunnerState,
  dt: number,
  holding: boolean
): { state: RunnerState; events: RunnerEvents } {
  const events = noEvents();
  if (previous.phase === 'done') {
    return { state: previous, events };
  }

  let state: RunnerState = { ...previous, time: previous.time + dt };
  const dog: RunnerDog = { ...state.dog };

  dog.slide = Math.max(0, dog.slide - dt);
  dog.stumble = Math.max(0, dog.stumble - dt);

  // --- Vertical ---------------------------------------------------------------------------------
  if (!onGround(dog)) {
    const hovering =
      holding && dog.jumps >= 1 && !dog.longJump && dog.vy <= 0 && dog.hoverLeft > 0;
    if (hovering) {
      dog.vy = 0;
      dog.hoverLeft = Math.max(0, dog.hoverLeft - dt);
    } else {
      dog.vy -= P.gravity * dt;
    }
    dog.y += dog.vy * dt;
    if (dog.y <= 0) {
      dog.y = 0;
      dog.vy = 0;
      dog.jumps = 0;
      dog.hoverLeft = 0;
      dog.longJump = false;
      events.landed = true;
    }
  }

  // --- El suelo pasa ----------------------------------------------------------------------------
  const boost = dog.longJump && !onGround(dog) ? P.longJumpBoost : 1;
  const scroll = P.speed * boost * dt;
  let obstacles = state.obstacles.map((o) => ({ ...o, x: o.x - scroll }));
  let queue = state.queue;
  let untilSpawn = state.untilSpawn - scroll;
  let nextId = state.nextId;

  // --- Salen los obstáculos ---------------------------------------------------------------------
  if (state.phase === 'running' && queue.length > 0 && untilSpawn <= 0) {
    const { piece, attempt } = queue[0];
    obstacles.push({
      id: nextId++,
      kind: piece.kind,
      color: piece.color,
      x: state.width + SPAWN_MARGIN,
      attempt,
      cleared: false,
      hit: false,
    });
    queue = queue.slice(1);
    untilSpawn = queue.length > 0 ? OBSTACLE_SHAPES[queue[0].piece.kind].gapBefore : 0;
  }

  // --- Choques y superados ----------------------------------------------------------------------
  let stumbles = state.stumbles;
  let cleared = state.cleared;
  const box = dogBox(dog);
  obstacles = obstacles.map((o) => {
    if (o.hit || o.cleared) {
      return o;
    }
    if (dog.stumble <= 0 && boxesOverlap(box, obstacleBox(o))) {
      stumbles++;
      dog.stumble = P.stumbleTime;
      events.stumbled = { ...o, hit: true };
      if (o.attempt === 0) {
        // La misma pieza vuelve una vez más, tras la distancia que pide
        queue = [{ piece: { kind: o.kind, color: o.color }, attempt: 1 }, ...queue];
        untilSpawn = Math.max(untilSpawn, OBSTACLE_SHAPES[o.kind].gapBefore);
      }
      return { ...o, hit: true };
    }
    if (o.x + OBSTACLE_SHAPES[o.kind].width < box.x0) {
      cleared++;
      const done = { ...o, cleared: true };
      events.cleared.push(done);
      return done;
    }
    return o;
  });
  obstacles = obstacles.filter((o) => o.x > DESPAWN_X);

  // --- Fin del recorrido ------------------------------------------------------------------------
  let phase = state.phase;
  if (phase === 'running' && queue.length === 0 && obstacles.every((o) => o.hit || o.cleared)) {
    phase = 'finishing';
    events.finishing = true;
    dog.slide = 0;
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
    queue,
    untilSpawn,
    nextId,
    stumbles,
    cleared,
  };

  // --- Una orden guardada se hace al aterrizar --------------------------------------------------
  if (state.buffer) {
    const ttl = state.buffer.ttl - dt;
    if (ttl <= 0) {
      state = { ...state, buffer: null };
    } else if (onGround(state.dog) && state.phase === 'running') {
      const result = perform({ ...state, buffer: null }, state.buffer.action);
      state = result.state;
      events.jumped = events.jumped || result.jumped;
    } else {
      state = { ...state, buffer: { ...state.buffer, ttl } };
    }
  }

  return { state, events };
}

/** Lo que se cuenta al terminar la carrera. */
export function runnerStats(state: RunnerState): RunnerStats {
  return {
    total: state.total,
    stumbles: state.stumbles,
    clean: state.stumbles === 0,
    durationMs: Math.round(state.time * 1000),
  };
}
