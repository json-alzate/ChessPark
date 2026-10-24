import {
  COOKIE_HIGH_Y,
  COOKIE_SIZE,
  difficultyForLevel,
  DOG_BOX,
  FIRST_GAP,
  LUNGE_HOP,
  MAX_LEVEL,
  OBSTACLE_SHAPES,
  PIECE_BEHAVIOR,
  PX_PER_METER,
  RUNNER_PHYSICS as P,
  WALL_COUNT,
  WALL_KINDS,
  WALL_MIN_SPACING,
} from '@features/chess-runner/config/runner.config';
import { RunnerObstacle, RunnerPiece, RunnerPieceKind, RunnerState } from '@features/chess-runner/models/runner.model';
import {
  airTimeAbove,
  boxesOverlap,
  CONTACT_X,
  cookieBox,
  createRun,
  dogBox,
  gapTimeAfter,
  jump,
  metersOf,
  obstacleBox,
  placeObstacle,
  runnerStats,
  stepRun,
  wallSpacing,
} from '@features/chess-runner/utils/runner-engine.util';
import { buildRunnerSequence, expectedRunSeconds } from '@features/chess-runner/utils/runner-sequence.util';
import { modifiersFor } from '@features/chess-runner/config/runner-powers';
import { ANCHO, carreraDeUno, correr, PASO, ventanasDeAcierto } from '@tests/support/chess-runner';

/**
 * El motor del Chess Runner: tocar para saltar, y dos toques para el doble salto. Las pruebas de «ventanas»
 * barren el instante del toque y miden cuánto margen deja cada pieza: son las que fijan el equilibrio del
 * juego. Si cambias una medida de `runner.config.ts` y una de estas falla, el juego se ha vuelto injusto o
 * trivial.
 */

const PIEZAS = Object.keys(OBSTACLE_SHAPES) as RunnerPieceKind[];
const CON_FALANGE = [...WALL_KINDS] as RunnerPieceKind[];

/** Con algo en la cola para que la carrera siga «corriendo» (una vacía pasa sola al tramo final y ya no acepta toques). */
const nueva = (): RunnerState => ({
  ...createRun([{ kind: 'pawn', color: 'w' }], ANCHO),
  untilSpawn: 99999,
});

/** Avanza `t` segundos sin tocar nada. */
function avanzar(state: RunnerState, t: number): RunnerState {
  let actual = state;
  for (let i = 0; i < Math.round(t / PASO); i++) {
    actual = stepRun(actual, PASO).state;
  }
  return actual;
}

/** Sigue hasta que aterriza; devuelve la altura máxima y lo que duró el vuelo. */
function hastaAterrizar(inicial: RunnerState) {
  let state = inicial;
  let maxima = 0;
  let t = 0;
  while ((state.dog.y > 0 || state.dog.vy > 0) && t < 3) {
    state = stepRun(state, PASO).state;
    maxima = Math.max(maxima, state.dog.y);
    t += PASO;
  }
  return { maxima, t, state };
}

describe('física del perrito', () => {
  it('un salto sube unos 62 px y dura casi ocho décimas: flotante a propósito, para dejar tiempo de acertar', () => {
    const { maxima, t } = hastaAterrizar(jump(nueva()).state);

    expect(maxima).toBeGreaterThan(60);
    expect(maxima).toBeLessThan(64);
    expect(t).toBeGreaterThan(0.76);
    expect(t).toBeLessThan(0.81);
  });

  it('en el suelo no hay vuelo: quieto, la altura y la velocidad siguen en 0', () => {
    const { state } = stepRun(nueva(), 0.5);

    expect(state.dog.y).toBe(0);
    expect(state.dog.vy).toBe(0);
  });

  it('tocar en el suelo salta y avisa', () => {
    const resultado = jump(nueva());

    expect(resultado.jumped).toBe(true);
    expect(resultado.double).toBe(false);
    expect(resultado.state.dog.vy).toBe(P.jumpVelocity);
    expect(resultado.state.dog.jumps).toBe(1);
  });

  it('aterrizar avisa una vez y devuelve todo a cero', () => {
    let state = jump(nueva()).state;
    let aterrizajes = 0;
    for (let i = 0; i < 400; i++) {
      const paso = stepRun(state, PASO);
      state = paso.state;
      aterrizajes += paso.events.landed ? 1 : 0;
    }

    expect(aterrizajes).toBe(1);
    expect(state.dog.y).toBe(0);
    expect(state.dog.vy).toBe(0);
    expect(state.dog.jumps).toBe(0);
  });

  describe('el doble salto', () => {
    it('un segundo toque pasada la cima da el segundo impulso al instante', () => {
      const bajando = avanzar(jump(nueva()).state, 0.4);
      expect(bajando.dog.vy).toBeLessThan(0);

      const segundo = jump(bajando);

      expect(segundo.jumped).toBe(true);
      expect(segundo.double).toBe(true);
      expect(segundo.state.dog.vy).toBe(P.doubleJumpVelocity);
      expect(segundo.state.dog.jumps).toBe(2);
    });

    it('un segundo toque subiendo espera a la cima: dos toques seguidos siempre salen bien', () => {
      const subiendo = jump(avanzar(jump(nueva()).state, 0.02));
      expect(subiendo.double).toBe(false);
      expect(subiendo.state.dog.doubleQueued).toBe(true);

      let state = subiendo.state;
      let dobles = 0;
      let alturaDelSegundo = 0;
      for (let i = 0; i < 400 && dobles === 0; i++) {
        const paso = stepRun(state, PASO);
        state = paso.state;
        dobles += paso.events.doubleJumped ? 1 : 0;
        alturaDelSegundo = state.dog.y;
      }

      expect(dobles).toBe(1);
      // Se ejecuta en la cima del primero (~62 px)
      expect(alturaDelSegundo).toBeGreaterThan(58);
      expect(state.dog.vy).toBeGreaterThan(P.doubleJumpVelocity - 20);
      expect(state.dog.doubleQueued).toBe(false);
    });

    it('con el doble salto se llega bastante más alto que con uno', () => {
      const sencillo = hastaAterrizar(jump(nueva()).state);
      const doble = hastaAterrizar(jump(jump(nueva()).state).state);

      expect(doble.maxima).toBeGreaterThan(sencillo.maxima + 30);
      expect(doble.t).toBeGreaterThan(sencillo.t + 0.25);
    });

    it('no hay triple salto: un tercer toque solo se guarda para el aterrizaje', () => {
      const dobleHecho = avanzar(jump(avanzar(jump(nueva()).state, 0.4)).state, 0.1);
      expect(dobleHecho.dog.jumps).toBe(2);
      const velocidad = dobleHecho.dog.vy;

      const tercero = jump(dobleHecho);

      expect(tercero.jumped).toBe(false);
      expect(tercero.state.dog.vy).toBe(velocidad);
      expect(tercero.state.jumpBuffer).toBe(P.inputBuffer);
    });

    it('al aterrizar se recupera: el siguiente salto vuelve a poder ser doble', () => {
      const { state } = hastaAterrizar(jump(jump(nueva()).state).state);
      expect(state.dog.jumps).toBe(0);

      const otro = jump(state);
      expect(otro.jumped).toBe(true);
      expect(otro.double).toBe(false);
      expect(jump(avanzar(otro.state, 0.4)).double).toBe(true);
    });

    it('un segundo toque pendiente que no llegó a ejecutarse no sobrevive al aterrizaje', () => {
      let state: RunnerState = { ...nueva(), dog: { ...nueva().dog, y: 1, vy: -300, jumps: 1, doubleQueued: true } };
      state = avanzar(state, 0.05);

      expect(state.dog.doubleQueued).toBe(false);
      expect(state.dog.jumps).toBe(0);
    });
  });

  describe('toque guardado un instante antes de aterrizar', () => {
    /** Avanza hasta que falta `falta` segundos para aterrizar (con el doble salto ya gastado). */
    function aPuntoDeAterrizar(falta: number) {
      let state = jump(avanzar(jump(nueva()).state, 0.4)).state;
      let t = 0;
      while (!(state.dog.vy < 0 && state.dog.y <= (-state.dog.vy * falta) / 2)) {
        state = stepRun(state, PASO).state;
        t += PASO;
        if (t > 3) throw new Error('no llegó a aterrizar');
      }
      return state;
    }

    it('un toque justo antes de aterrizar se hace al tocar el suelo', () => {
      let state = jump(aPuntoDeAterrizar(0.05)).state;
      let saltos = 0;
      for (let i = 0; i < 120; i++) {
        const paso = stepRun(state, PASO);
        state = paso.state;
        saltos += paso.events.jumped ? 1 : 0;
      }

      expect(saltos).toBe(1);
    });

    it('un toque demasiado pronto caduca y no se hace al aterrizar', () => {
      let state = jump(aPuntoDeAterrizar(0.4)).state;
      let saltos = 0;
      for (let i = 0; i < 400; i++) {
        const paso = stepRun(state, PASO);
        state = paso.state;
        saltos += paso.events.jumped ? 1 : 0;
      }

      expect(saltos).toBe(0);
      expect(state.jumpBuffer).toBe(0);
    });
  });

  it('fuera de la carrera los toques no hacen nada', () => {
    const terminada = correr(createRun([], ANCHO)).state;
    const resultado = jump(terminada);

    expect(resultado.jumped).toBe(false);
    expect(resultado.state).toBe(terminada);
  });
});

describe('colisiones', () => {
  const pieza = (kind: RunnerPieceKind, x: number): RunnerObstacle =>
    placeObstacle(
      { id: 1, kind, color: 'w', plan: x, x, y: 0, width: OBSTACLE_SHAPES[kind].width, height: OBSTACLE_SHAPES[kind].height, count: 1, spacing: 0, cleared: false, hit: false },
      P.speed
    );

  it('un obstáculo dentro del cuerpo choca; uno justo al lado no', () => {
    const dog = createRun([], ANCHO).dog;
    const caja = dogBox(dog);

    expect(boxesOverlap(caja, { x0: caja.x0 + 2, x1: caja.x0 + 10, y0: 0, y1: 10 })).toBe(true);
    expect(boxesOverlap(caja, { x0: caja.x1, x1: caja.x1 + 10, y0: 0, y1: 10 })).toBe(false);
  });

  it('tocar solo el borde no es chocar', () => {
    const a = { x0: 0, x1: 10, y0: 0, y1: 10 };
    expect(boxesOverlap(a, { x0: 10, x1: 20, y0: 0, y1: 10 })).toBe(false);
    expect(boxesOverlap(a, { x0: 0, x1: 10, y0: 10, y1: 20 })).toBe(false);
  });

  it('las piezas están pegadas al suelo (salvo el alfil, que flota): por debajo no se pasa, hay que saltar', () => {
    for (const kind of PIEZAS) {
      const caja = obstacleBox(pieza(kind, CONTACT_X + 50));
      expect(caja.y0).toBe(PIECE_BEHAVIOR[kind].lift);
      expect(caja.y1).toBe(PIECE_BEHAVIOR[kind].lift + OBSTACLE_SHAPES[kind].height);
      // Ni siquiera el alfil deja pasar por debajo al perrito de pie
      expect(caja.y0).toBeLessThan(DOG_BOX.height);
    }
  });

  it('saltando por encima de una pieza no hay choque; de pie, sí', () => {
    const rey = pieza('king', 44);
    const base = { ...createRun([], ANCHO).dog, x: 55 };

    expect(boxesOverlap(dogBox(base), obstacleBox(rey))).toBe(true);
    expect(boxesOverlap(dogBox({ ...base, y: OBSTACLE_SHAPES.king.height + 1 }), obstacleBox(rey))).toBe(false);
  });
});

describe('equilibrio de cada pieza', () => {
  /** Margen mínimo (en segundos) que debe dejar el tamaño de cada pieza para que el juego sea justo. */
  const MARGEN_MINIMO = 0.38;

  it.each(PIEZAS)('el %s se supera con un salto y deja un margen razonable', (kind) => {
    const { mejor } = ventanasDeAcierto(kind);

    expect(mejor).toBeGreaterThanOrEqual(MARGEN_MINIMO);
  });

  it.each(PIEZAS)('también a la velocidad del último nivel: el %s sigue dejando margen', (kind) => {
    expect(ventanasDeAcierto(kind, { nivel: MAX_LEVEL }).mejor).toBeGreaterThanOrEqual(MARGEN_MINIMO);
  });

  it('el peón es la más fácil y las piezas grandes dejan menos margen', () => {
    const margen = (kind: RunnerPieceKind) => ventanasDeAcierto(kind).mejor;

    expect(margen('pawn')).toBeGreaterThan(margen('queen'));
    expect(margen('pawn')).toBeGreaterThan(margen('king'));
  });

  it.each(PIEZAS)('sin hacer nada, el %s tropieza', (kind) => {
    const r = correr(carreraDeUno(kind));

    expect(r.tropiezos).toBeGreaterThan(0);
  });

  it.each(PIEZAS)('saltar mucho antes o mucho después del %s no sirve', (kind) => {
    const { aciertos } = ventanasDeAcierto(kind);
    const primero = aciertos[0];
    const ultimo = aciertos[aciertos.length - 1];

    expect(ventanasDeAcierto(kind, { desde: 0, hasta: primero - 0.1 }).aciertos).toEqual([]);
    expect(ventanasDeAcierto(kind, { desde: ultimo + 0.1, hasta: ultimo + 0.6 }).aciertos).toEqual([]);
  });

  it('la ventana de cada pieza está dentro de lo que dura el recorrido hasta ella (se puede ver venir)', () => {
    // El obstáculo sale a ANCHO + 10 y llega al perrito tras recorrer esa distancia
    const llegada = (ANCHO + 10 - CONTACT_X) / P.speed;
    for (const kind of PIEZAS) {
      const { aciertos } = ventanasDeAcierto(kind);
      expect(aciertos[0]).toBeGreaterThan(llegada - 1);
      expect(aciertos[aciertos.length - 1]).toBeLessThan(llegada + 0.1);
    }
  });
});

describe('cómo se mueve cada pieza', () => {
  const pieza = (kind: RunnerPieceKind, plan: number, speed = P.speed): RunnerObstacle =>
    placeObstacle(
      { id: 1, kind, color: 'w', plan, x: 0, y: 0, width: OBSTACLE_SHAPES[kind].width, height: OBSTACLE_SHAPES[kind].height, count: 1, spacing: 0, cleared: false, hit: false },
      speed
    );

  it.each(PIEZAS)('el %s llega al perrito justo cuando lo haría una pieza quieta', (kind) => {
    expect(pieza(kind, CONTACT_X).x).toBeCloseTo(CONTACT_X, 5);
  });

  it('el peón y el rey se acercan con el suelo, sin más', () => {
    for (const kind of ['pawn', 'king'] as const) {
      expect(pieza(kind, 150).x).toBe(150);
      expect(pieza(kind, 150).y).toBe(0);
    }
  });

  it('la torre se desliza: se ve más lejos y se acerca más rápido que el suelo', () => {
    const lejos = pieza('rook', 200);
    const mas = pieza('rook', 190);

    expect(lejos.x).toBeGreaterThan(200);
    expect(lejos.x - mas.x).toBeCloseTo(10 * PIECE_BEHAVIOR.rook.slide, 5);
  });

  it('el caballo da un salto en L poco antes de llegar: avanza de golpe y se eleva', () => {
    const velocidad = P.speed;
    const antes = pieza('knight', CONTACT_X + velocidad * 1.1, velocidad);
    const despues = pieza('knight', CONTACT_X + velocidad * 0.6, velocidad);
    const enElAire = pieza('knight', CONTACT_X + velocidad * 0.8, velocidad);

    // Antes del salto va adelantado; después, en su sitio
    expect(antes.x - (CONTACT_X + velocidad * 1.1)).toBeCloseTo(PIECE_BEHAVIOR.knight.lunge, 5);
    expect(despues.x).toBeCloseTo(CONTACT_X + velocidad * 0.6, 5);
    expect(antes.y).toBe(0);
    expect(despues.y).toBe(0);
    // A medio salto va en el aire
    expect(enElAire.y).toBeGreaterThan(LUNGE_HOP * 0.5);
  });

  it('la dama combina las dos cosas: se desliza y salta en L', () => {
    expect(PIECE_BEHAVIOR.queen.slide).toBeGreaterThan(1);
    expect(PIECE_BEHAVIOR.queen.lunge).toBeGreaterThan(0);
  });

  it('el alfil flota: el perrito de pie choca con él y solo se pasa en lo alto del salto', () => {
    const alfil = pieza('bishop', 44);
    expect(alfil.y).toBe(PIECE_BEHAVIOR.bishop.lift);

    const dog = { ...createRun([], ANCHO).dog, x: 55 };
    expect(boxesOverlap(dogBox(dog), obstacleBox(alfil))).toBe(true);
    expect(boxesOverlap(dogBox({ ...dog, y: alfil.y + alfil.height + 1 }), obstacleBox(alfil))).toBe(false);
  });

  it('ninguna pieza llega antes de tiempo: el salto en L no la adelanta a la hora prevista', () => {
    // A cualquier distancia, una pieza que salta o se desliza va por delante de donde estaría quieta
    for (const kind of PIEZAS) {
      for (const plan of [CONTACT_X, CONTACT_X + 30, CONTACT_X + 90, CONTACT_X + 150]) {
        expect(pieza(kind, plan).x).toBeGreaterThanOrEqual(plan - 1e-9);
      }
    }
  });
});

describe('falanges: tres piezas en fila que piden el doble salto', () => {
  it('separación: mínima, y crece con la velocidad', () => {
    for (const kind of CON_FALANGE) {
      expect(wallSpacing(kind, 100)).toBeGreaterThanOrEqual(WALL_MIN_SPACING);
      expect(wallSpacing(kind, 230)).toBeGreaterThan(wallSpacing(kind, 120));
    }
  });

  it.each(CON_FALANGE)('la falange de %s sale con sus tres piezas separadas y ocupa todo el ancho', (kind) => {
    let state = carreraDeUno(kind, 'w', { falange: true });
    state = stepRun(state, PASO).state;
    const [falange] = state.obstacles;

    expect(falange.count).toBe(WALL_COUNT);
    expect(falange.spacing).toBe(wallSpacing(kind, P.speed * 1.04));
    expect(falange.width).toBe((WALL_COUNT - 1) * falange.spacing + OBSTACLE_SHAPES[kind].width);
  });

  describe.each(CON_FALANGE)('con %s', (kind) => {
    it.each([1, 5, MAX_LEVEL])('en el nivel %s, un salto sencillo nunca la pasa', (nivel) => {
      expect(ventanasDeAcierto(kind, { nivel, falange: true, paso: 0.01 }).aciertos).toEqual([]);
    });

    it.each([1, 5, MAX_LEVEL])('en el nivel %s, el doble salto sí, con margen', (nivel) => {
      const { mejor } = ventanasDeAcierto(kind, { nivel, falange: true, doble: true, paso: 0.01 });

      expect(mejor).toBeGreaterThanOrEqual(0.26);
    });
  });

  it('sin tocar nada, una falange hace tropezar', () => {
    expect(correr(carreraDeUno('pawn', 'w', { falange: true })).tropiezos).toBeGreaterThan(0);
  });

  it('el tiempo que se pasa en el aire sobre una altura baja con la altura', () => {
    expect(airTimeAbove(10)).toBeGreaterThan(airTimeAbove(30));
    expect(airTimeAbove(P.jumpVelocity ** 2 / (2 * P.gravity) + 1)).toBe(0);
  });
});

describe('tropiezo', () => {
  it('tropezar suma, hace invulnerable al perrito y avisa de qué obstáculo fue', () => {
    let state = carreraDeUno('pawn');
    let tropiezo = null;
    for (let i = 0; i < 1000 && !tropiezo; i++) {
      const paso = stepRun(state, PASO);
      state = paso.state;
      tropiezo = paso.events.stumbled;
    }

    expect(tropiezo).toMatchObject({ kind: 'pawn', hit: true });
    expect(state.stumbles).toBe(1);
    expect(state.dog.stumble).toBeCloseTo(P.stumbleTime, 1);
  });

  it('la pieza con la que se choca no vuelve a salir: un choque cuesta un corazón y ya', () => {
    const r = correr(carreraDeUno('pawn'));

    expect(r.tropiezos).toBe(1);
    expect(r.state.stumbles).toBe(1);
    expect(r.state.queue).toEqual([]);
    expect(r.state.phase).toBe('done');
  });

  it('tras un choque la carrera sigue y termina: no se queda atascada', () => {
    const r = correr(createRun([{ kind: 'pawn', color: 'w' }, { kind: 'rook', color: 'b' }], ANCHO));

    expect(r.state.phase).toBe('done');
    expect(r.t).toBeLessThan(12);
  });

  it('mientras está tropezado no vuelve a chocar con otro obstáculo seguido', () => {
    // Dos peones muy juntos, sin hacer nada: el segundo no cuenta si cae dentro de la invulnerabilidad
    let state: RunnerState = createRun([], ANCHO);
    const peon = (id: number, x: number): RunnerObstacle => ({
      id, kind: 'pawn', color: 'w', plan: x, x, y: 0, width: OBSTACLE_SHAPES.pawn.width, height: OBSTACLE_SHAPES.pawn.height, count: 1, spacing: 0, cleared: false, hit: false,
    });
    state = { ...state, obstacles: [peon(1, 40), peon(2, 70)] };
    let tropiezos = 0;
    for (let i = 0; i < 600; i++) {
      const paso = stepRun(state, PASO);
      state = paso.state;
      tropiezos += paso.events.stumbled ? 1 : 0;
    }

    expect(tropiezos).toBe(1);
  });

  it('un obstáculo que ya chocó no vuelve a chocar ni a contarse', () => {
    let state = carreraDeUno('pawn');
    let choques = 0;
    for (let i = 0; i < 500; i++) {
      const paso = stepRun(state, PASO);
      state = paso.state;
      choques += paso.events.stumbled ? 1 : 0;
      if (paso.events.stumbled) break;
    }
    const hit = state.obstacles.find((o) => o.hit)!;
    for (let i = 0; i < 300; i++) {
      const paso = stepRun({ ...state, dog: { ...state.dog, stumble: 0 } }, PASO);
      state = paso.state;
    }

    expect(choques).toBe(1);
    expect(hit.cleared).toBe(false);
  });
});

describe('galletas', () => {
  /** La carrera de un obstáculo (con su ritmo) hasta que sale, para ver qué galletas trae. */
  const conGalletas = (beat: number, falange = false) => {
    const inicial = createRun([{ kind: 'pawn', color: 'w', beat, wall: falange ? WALL_COUNT : undefined }, { kind: 'pawn', color: 'w' }], ANCHO);
    return stepRun({ ...inicial, untilSpawn: 0 }, PASO).state;
  };

  it('sobre cada pieza hay galletas, a una altura que obliga a saltar bien', () => {
    const arco = conGalletas(0.9).pickups;

    expect(arco.length).toBeGreaterThanOrEqual(3);
    for (const galleta of arco) {
      expect(galleta.y).toBeGreaterThan(DOG_BOX.height);
    }
  });

  it('con ritmo corto hay además una figura a ras de suelo, a mitad del hueco', () => {
    const galletas = conGalletas(0.1).pickups;
    const suelo = galletas.filter((c) => c.y <= DOG_BOX.height);

    expect(suelo.length).toBeGreaterThanOrEqual(2);
    // Quedan después de la pieza
    for (const g of suelo) {
      expect(g.x).toBeGreaterThan(ANCHO + 10);
    }
  });

  it('sobre una falange las galletas están arriba del todo: solo llega el doble salto', () => {
    const galletas = conGalletas(0.9, true).pickups;

    expect(galletas).toHaveLength(3);
    for (const g of galletas) {
      expect(g.y).toBe(COOKIE_HIGH_Y);
    }
    const singleMax = P.jumpVelocity ** 2 / (2 * P.gravity);
    expect(COOKIE_HIGH_Y - DOG_BOX.height).toBeGreaterThan(singleMax);
  });

  it('correr por una fila de suelo las recoge sin saltar', () => {
    let state = conGalletas(0.1);
    // Solo las del suelo: se quita la pieza para no chocar
    const delSuelo = state.pickups.filter((c) => c.y <= DOG_BOX.height);
    state = { ...state, obstacles: [], pickups: delSuelo, queue: [{ kind: 'pawn', color: 'w' }], untilSpawn: 99999 };
    let cogidas = 0;
    for (let i = 0; i < 4000; i++) {
      const paso = stepRun(state, PASO);
      state = paso.state;
      cogidas += paso.events.cookies;
    }

    expect(cogidas).toBe(delSuelo.length);
    expect(state.cookies).toBe(delSuelo.length);
    expect(state.pickups).toHaveLength(0);
  });

  it('las de arriba pasan de largo si no se salta', () => {
    let state = conGalletas(0.9);
    state = { ...state, obstacles: [], queue: [{ kind: 'pawn', color: 'w' }], untilSpawn: 99999 };
    let cogidas = 0;
    for (let i = 0; i < 4000; i++) {
      const paso = stepRun(state, PASO);
      state = paso.state;
      cogidas += paso.events.cookies;
    }

    expect(cogidas).toBe(0);
  });

  it('saltando a tiempo sobre una pieza se coge el arco, y las de falange pedían el doble salto', () => {
    const arco = correr(carreraDeUno('pawn'), { toques: [0.98] });
    expect(arco.tropiezos).toBe(0);
    expect(arco.galletas).toBeGreaterThanOrEqual(2);

    const falange = ventanasDeAcierto('pawn', { falange: true, doble: true, paso: 0.01 }).aciertos;
    const medio = falange[Math.floor(falange.length / 2)];
    const alta = correr(carreraDeUno('pawn', 'w', { falange: true }), { toques: [medio, medio + 0.03] });
    expect(alta.tropiezos).toBe(0);
    expect(alta.galletas).toBeGreaterThanOrEqual(2);

    const baja = correr(carreraDeUno('pawn', 'w', { falange: true }), { toques: [medio] });
    expect(baja.galletas).toBe(0);
  });

  it('la caja de una galleta es de su tamaño', () => {
    const caja = cookieBox({ x: 10, y: 5 });
    expect(caja.x1 - caja.x0).toBe(COOKIE_SIZE);
    expect(caja.y1 - caja.y0).toBe(COOKIE_SIZE);
  });
});

describe('la carrera', () => {
  const secuencia: RunnerPiece[] = [
    { kind: 'pawn', color: 'w' },
    { kind: 'rook', color: 'b' },
    { kind: 'bishop', color: 'w' },
    { kind: 'knight', color: 'b' },
    { kind: 'queen', color: 'w' },
    { kind: 'king', color: 'b' },
  ];

  it('el primer obstáculo sale tras la distancia inicial', () => {
    let state = createRun(secuencia, ANCHO);
    let t = 0;
    while (state.obstacles.length === 0) {
      state = stepRun(state, PASO).state;
      t += PASO;
    }

    expect(t).toBeCloseTo(FIRST_GAP / P.speed, 1);
    expect(state.obstacles[0].plan).toBeLessThanOrEqual(ANCHO + 10);
    expect(state.obstacles[0].plan).toBeGreaterThan(ANCHO);
  });

  /** Corre sin que el jugador haga nada ni choque, y devuelve en qué segundo salió cada obstáculo. */
  function salidas(piezas: RunnerPiece[], nivel = 1) {
    let state = createRun(piezas, ANCHO, difficultyForLevel(nivel));
    const tiempos: number[] = [];
    const vistos = new Set<number>();
    let t = 0;
    while (tiempos.length < piezas.length && t < 30) {
      // El suelo corre sin que el jugador haga nada: se anula el choque para medir solo las salidas
      state = { ...stepRun(state, PASO).state, dog: { ...state.dog, stumble: 5 } };
      t += PASO;
      for (const o of state.obstacles) {
        if (!vistos.has(o.id)) {
          vistos.add(o.id);
          tiempos.push(t);
        }
      }
    }
    return tiempos;
  }

  it('el hueco tras cada pieza depende de su ritmo: de menor a mayor dentro del nivel', () => {
    const d = difficultyForLevel(1);
    const [t0, t1, t2] = salidas([
      { kind: 'pawn', color: 'w', beat: 0 },
      { kind: 'pawn', color: 'w', beat: 1 },
      { kind: 'pawn', color: 'w' },
    ]);

    // El suelo acelera algo entre salidas (se superan piezas), así que se admite un margen
    expect(t1 - t0).toBeGreaterThan(d.minGapTime * 0.9);
    expect(t1 - t0).toBeLessThan(d.minGapTime * 1.15);
    expect(t2 - t1).toBeGreaterThan(d.maxGapTime * 0.85);
    expect(t2 - t1).toBeLessThan(d.maxGapTime * 1.15);
    expect(gapTimeAfter(d, undefined)).toBeCloseTo((d.minGapTime + d.maxGapTime) / 2, 5);
  });

  it('tras una falange el hueco es mayor: el doble salto aterriza más lejos', () => {
    const [a0, a1] = salidas([{ kind: 'pawn', color: 'w', beat: 0.5 }, { kind: 'pawn', color: 'w' }]);
    const [b0, b1] = salidas([{ kind: 'pawn', color: 'w', beat: 0.5, wall: WALL_COUNT }, { kind: 'pawn', color: 'w' }]);

    expect(b1 - b0).toBeGreaterThan(a1 - a0 + 0.3);
  });

  it('a más nivel, menos hueco entre piezas', () => {
    const piezas: RunnerPiece[] = [
      { kind: 'pawn', color: 'w', beat: 0.5 },
      { kind: 'pawn', color: 'w', beat: 0.5 },
    ];
    const [a0, a1] = salidas(piezas, 1);
    const [b0, b1] = salidas(piezas, MAX_LEVEL);

    expect(b1 - b0).toBeLessThan(a1 - a0);
  });

  it('al superar el último obstáculo el perrito corre hacia el tablero y la carrera termina', () => {
    const r = correr(createRun([{ kind: 'pawn', color: 'w' }], ANCHO), {
      toques: [FIRST_GAP / P.speed + 0.8],
    });

    expect(r.state.phase).toBe('done');
    expect(r.state.dog.x).toBeGreaterThan(ANCHO);
  });

  it('avisa una vez de que empieza el tramo final y una de que terminó', () => {
    let state = createRun([], ANCHO);
    let finishing = 0;
    let done = 0;
    for (let i = 0; i < 5000 && state.phase !== 'done'; i++) {
      const paso = stepRun(state, PASO);
      state = paso.state;
      finishing += paso.events.finishing ? 1 : 0;
      done += paso.events.done ? 1 : 0;
    }

    expect([finishing, done]).toEqual([1, 1]);
  });

  it('una carrera sin obstáculos termina sola', () => {
    const r = correr(createRun([], ANCHO));
    expect(r.state.phase).toBe('done');
  });

  it('una vez terminada, seguir dando pasos no cambia nada', () => {
    const r = correr(createRun([], ANCHO));
    const otra = stepRun(r.state, 1);

    expect(otra.state).toBe(r.state);
    expect(otra.events.done).toBe(false);
  });

  /**
   * Un bot que decide con el tiempo que falta para que la pieza llegue (no con el reloj ni con una
   * distancia fija): así prueba también que el hueco entre piezas deja tiempo de aterrizar y volver a
   * saltar, a cualquier velocidad. Para una falange da dos toques seguidos.
   */
  function carreraDelBot(piezas: RunnerPiece[], nivel: number, antelacion = 0.28, antelacionFalange = 0.2) {
    let state = createRun(piezas, ANCHO, difficultyForLevel(nivel));
    const hecho = new Set<number>();
    let t = 0;
    while (state.phase !== 'done' && t < 90) {
      const delante = state.obstacles.find((o) => !o.hit && !o.cleared && !hecho.has(o.id));
      if (delante) {
        const llega = (delante.plan - CONTACT_X) / state.speed;
        if (llega <= (delante.count > 1 ? antelacionFalange : antelacion)) {
          hecho.add(delante.id);
          state = jump(state).state;
          if (delante.count > 1) {
            state = jump(state).state;
          }
        }
      }
      state = stepRun(state, PASO).state;
      t += PASO;
    }
    return state;
  }

  it('un jugador que toca cuando la pieza está cerca pasa toda la carrera sin tropezar', () => {
    const state = carreraDelBot(secuencia, 1);

    expect(state.phase).toBe('done');
    expect(state.stumbles).toBe(0);
    expect(state.cleared).toBe(secuencia.length);
    expect(runnerStats(state).clean).toBe(true);
  });

  it.each([1, 4, 7, MAX_LEVEL])('en el nivel %s, con el ritmo más apretado, sigue siendo posible', (nivel) => {
    // Lo más duro del nivel: las piezas altas, siempre con el menor hueco
    const duras: RunnerPiece[] = ['king', 'queen', 'king', 'queen', 'knight', 'bishop', 'rook', 'pawn'].map((kind) => ({
      kind: kind as RunnerPieceKind,
      color: 'w',
      beat: 0,
    }));
    const state = carreraDelBot(duras, nivel);

    expect(state.stumbles).toBe(0);
    expect(state.cleared).toBe(duras.length);
  });

  it.each([2, 5, MAX_LEVEL])('en el nivel %s, con falanges y el ritmo más apretado, sigue siendo posible', (nivel) => {
    const kinds: RunnerPieceKind[] = ['pawn', 'pawn', 'bishop', 'knight', 'king'];
    const piezas: RunnerPiece[] = kinds.map((kind, i) => ({
      kind,
      color: 'w',
      beat: 0,
      wall: i === 1 || i === 3 ? WALL_COUNT : undefined,
    }));
    const state = carreraDelBot(piezas, nivel);

    expect(state.stumbles).toBe(0);
    expect(state.cleared).toBe(piezas.length);
  });

  describe('las carreras que arma el ejercicio, de punta a punta', () => {
    const INICIAL = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const MEDIO = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
    const FINAL = '4k3/8/8/8/8/8/8/R3K3 w - - 0 1';

    it.each([1, 2, 4, 6, 8, MAX_LEVEL])('en el nivel %s un jugador atento las pasa todas sin chocar', (nivel) => {
      for (const fen of [INICIAL, MEDIO, FINAL]) {
        const piezas = buildRunnerSequence(fen, `ej-${nivel}`, nivel);
        const state = carreraDelBot(piezas, nivel);

        expect(state.phase).toBe('done');
        expect(state.stumbles).toBe(0);
        expect(state.cleared).toBe(piezas.length);
      }
    });

    it.each([1, 5, MAX_LEVEL])('en el nivel %s dura entre veinte y treinta y cinco segundos', (nivel) => {
      for (const fen of [INICIAL, MEDIO, FINAL]) {
        const piezas = buildRunnerSequence(fen, 'ej-1', nivel);
        const state = carreraDelBot(piezas, nivel);

        expect(state.time).toBeGreaterThan(20);
        expect(state.time).toBeLessThan(35);
        // Y lo previsto se parece a lo que dura de verdad
        expect(Math.abs(state.time - expectedRunSeconds(piezas, difficultyForLevel(nivel)))).toBeLessThan(5);
      }
    });

    it('un respiro deja una cinta de galletas que se coge corriendo y saltando', () => {
      const piezas: RunnerPiece[] = [
        { kind: 'pawn', color: 'w', beat: 0.9, rest: 2.4 },
        { kind: 'pawn', color: 'w', beat: 0.9 },
      ];
      let state = createRun(piezas, ANCHO);
      let cintas = 0;
      const hecho = new Set<number>();
      for (let i = 0; i < 20000 && state.phase !== 'done'; i++) {
        const delante = state.obstacles.find((o) => !o.hit && !o.cleared && !hecho.has(o.id));
        if (delante && (delante.plan - CONTACT_X) / state.speed <= 0.28) {
          hecho.add(delante.id);
          state = jump(state).state;
        }
        const paso = stepRun(state, PASO);
        state = paso.state;
        cintas += paso.events.cookies;
      }

      // Tres del arco de cada pieza (6) más la cinta del respiro (varias): la cinta aporta bastantes más
      expect(state.stumbles).toBe(0);
      expect(cintas).toBeGreaterThan(10);
    });

    it('el respiro alarga el hueco con la pieza siguiente justo lo que dura', () => {
      const sin = createRun(
        [{ kind: 'pawn', color: 'w', beat: 0.5 }, { kind: 'pawn', color: 'w' }],
        ANCHO
      );
      const con = createRun(
        [{ kind: 'pawn', color: 'w', beat: 0.5, rest: 2.4 }, { kind: 'pawn', color: 'w' }],
        ANCHO
      );
      const segundoEn = (inicial: RunnerState) => {
        let state = { ...inicial, untilSpawn: 0 };
        const vistos = new Set<number>();
        let t = 0;
        // Se cuentan por número: el primero ya salió de pantalla cuando sale el segundo
        while (vistos.size < 2 && t < 20) {
          state = { ...stepRun(state, PASO).state, dog: { ...state.dog, stumble: 9 } };
          state.obstacles.forEach((o) => vistos.add(o.id));
          t += PASO;
        }
        return t;
      };

      expect(segundoEn(con) - segundoEn(sin)).toBeGreaterThan(2.2);
      expect(segundoEn(con) - segundoEn(sin)).toBeLessThan(2.6);
    });
  });

  describe('progreso de la carrera', () => {
    it('el suelo acelera a medida que se superan piezas', () => {
      const state = carreraDelBot(secuencia, 3);
      const d = difficultyForLevel(3);

      expect(state.speed).toBeGreaterThan(d.startSpeed + 0.8 * (d.endSpeed - d.startSpeed));
      expect(state.speed).toBeLessThanOrEqual(d.endSpeed + 0.01);
    });

    it('empieza a la velocidad inicial del nivel', () => {
      const d = difficultyForLevel(5);

      expect(createRun(secuencia, ANCHO, d).speed).toBe(d.startSpeed);
    });

    it('la racha sube con cada pieza superada y se rompe al tropezar', () => {
      let state = carreraDeUno('pawn');
      for (let i = 0; i < 4000 && state.stumbles === 0; i++) {
        state = stepRun(state, PASO).state;
      }
      expect(state.combo).toBe(0);

      const limpio = carreraDelBot(secuencia, 1);
      expect(limpio.combo).toBe(secuencia.length);
      expect(limpio.bestCombo).toBe(secuencia.length);
      expect(runnerStats(limpio).bestCombo).toBe(secuencia.length);
    });

    it('la racha mayor se recuerda aunque luego se tropiece', () => {
      let state = createRun(secuencia, ANCHO);
      const hecho = new Set<number>();
      // Se salta todo menos la quinta pieza
      for (let i = 0; i < 20000 && state.phase !== 'done'; i++) {
        const delante = state.obstacles.find((o) => !o.hit && !o.cleared && !hecho.has(o.id));
        if (delante && (delante.plan - CONTACT_X) / state.speed <= 0.28) {
          hecho.add(delante.id);
          if (delante.kind !== 'queen') {
            state = jump(state).state;
          }
        }
        state = stepRun(state, PASO).state;
      }

      expect(state.stumbles).toBe(1);
      expect(state.bestCombo).toBe(4);
      expect(state.combo).toBe(1);
    });
  });

  describe('metros y estadísticas', () => {
    it('los metros salen de lo que ha pasado el suelo', () => {
      expect(metersOf({ distance: PX_PER_METER * 12.9 })).toBe(12);
      expect(metersOf({ distance: 0 })).toBe(0);
    });

    it('una carrera de varias piezas suma más metros a más nivel (va más rápido, pero dura menos): ambos son razonables', () => {
      const bajo = carreraDelBot(secuencia, 1);
      const alto = carreraDelBot(secuencia, MAX_LEVEL);

      expect(metersOf(bajo)).toBeGreaterThan(60);
      expect(metersOf(alto)).toBeGreaterThan(60);
    });
  });

  describe('dificultad por nivel', () => {
    it('sube con el nivel: más velocidad y menos hueco', () => {
      for (let nivel = 1; nivel < MAX_LEVEL; nivel++) {
        const a = difficultyForLevel(nivel);
        const b = difficultyForLevel(nivel + 1);
        expect(b.startSpeed).toBeGreaterThan(a.startSpeed);
        expect(b.endSpeed).toBeGreaterThan(a.endSpeed);
        // El hueco menor se apoya en un suelo (el vuelo de un salto y un respiro): a partir de ahí ya no baja más
        expect(b.minGapTime).toBeLessThanOrEqual(a.minGapTime);
        expect(b.maxGapTime).toBeLessThan(a.maxGapTime);
      }
    });

    it('dentro de cada nivel la carrera acaba más rápida de lo que empezó', () => {
      for (let nivel = 1; nivel <= MAX_LEVEL; nivel++) {
        const d = difficultyForLevel(nivel);
        expect(d.endSpeed).toBeGreaterThan(d.startSpeed);
        expect(d.maxGapTime).toBeGreaterThan(d.minGapTime);
      }
    });

    it('el nivel 1 es el de partida y pasado el máximo ya no sube', () => {
      expect(difficultyForLevel(1).startSpeed).toBe(P.speed);
      expect(difficultyForLevel(MAX_LEVEL + 7)).toEqual(difficultyForLevel(MAX_LEVEL));
      expect(difficultyForLevel(0).level).toBe(1);
      expect(difficultyForLevel(NaN).level).toBe(1);
    });

    it('el menor hueco de cualquier nivel deja tiempo de sobra para aterrizar', () => {
      const vuelo = (2 * P.jumpVelocity) / P.gravity;
      for (let nivel = 1; nivel <= MAX_LEVEL; nivel++) {
        expect(difficultyForLevel(nivel).minGapTime).toBeGreaterThan(vuelo + 0.15);
      }
    });
  });
});

describe('los poderes dentro de la carrera', () => {
  const conPoderes = (poderes: Parameters<typeof modifiersFor>[0], piezas: RunnerPiece[] = [{ kind: 'pawn', color: 'w' }]) => ({
    ...createRun(piezas, ANCHO, difficultyForLevel(1), modifiersFor(poderes)),
    untilSpawn: 0,
  });

  it('sin poderes no hay escudo ni ayudas', () => {
    const state = createRun([], ANCHO);

    expect(state.shields).toBe(0);
    expect(state.mods.tapCue).toBe(false);
  });

  describe('el escudo', () => {
    it('empieza cada carrera con su escudo', () => {
      expect(conPoderes(['shield']).shields).toBe(1);
    });

    it('aguanta el primer choque: ni tropiezo, ni corazón, ni racha perdida; avisa de que se rompió', () => {
      let state = conPoderes(['shield']);
      let aguantado: RunnerObstacle | null = null;
      let tropiezo = 0;
      for (let i = 0; i < 1500; i++) {
        const paso = stepRun(state, PASO);
        state = paso.state;
        aguantado = aguantado ?? paso.events.shielded;
        tropiezo += paso.events.stumbled ? 1 : 0;
      }

      expect(aguantado).toMatchObject({ kind: 'pawn', hit: true });
      expect(tropiezo).toBe(0);
      expect(state.stumbles).toBe(0);
      expect(state.shields).toBe(0);
    });

    it('el segundo choque ya no lo aguanta', () => {
      const dos: RunnerPiece[] = [{ kind: 'pawn', color: 'w', beat: 0 }, { kind: 'pawn', color: 'w' }];
      const r = correr(conPoderes(['shield'], dos));

      expect(r.tropiezos).toBe(1);
      expect(r.state.shields).toBe(0);
    });

    it('tras el golpe deja un respiro corto de invulnerabilidad', () => {
      let state = conPoderes(['shield']);
      for (let i = 0; i < 1500 && state.shields > 0; i++) {
        state = stepRun(state, PASO).state;
      }

      expect(state.dog.stumble).toBeGreaterThan(0);
      expect(state.dog.stumble).toBeLessThanOrEqual(0.6);
    });

    it('una carrera sin choques conserva el escudo', () => {
      const r = carreraDelBotGeneral([{ kind: 'pawn', color: 'w' }], ['shield']);

      expect(r.shields).toBe(1);
      expect(r.stumbles).toBe(0);
    });
  });

  it('esquivar: tras un choque se es invulnerable el doble de tiempo', () => {
    const tras = (poderes: Parameters<typeof modifiersFor>[0]) => {
      let state = conPoderes(poderes);
      for (let i = 0; i < 1500 && state.stumbles === 0; i++) {
        state = stepRun(state, PASO).state;
      }
      return state.dog.stumble;
    };

    expect(tras(['dodge'])).toBeGreaterThan(tras([]) * 1.9);
  });

  it('el doble salto con el muelle llega más alto', () => {
    const altura = (poderes: Parameters<typeof modifiersFor>[0]) => {
      const inicial = { ...createRun([{ kind: 'pawn', color: 'w' }], ANCHO, difficultyForLevel(1), modifiersFor(poderes)), untilSpawn: 99999 };
      return hastaAterrizar(jump(jump(inicial).state).state).maxima;
    };

    expect(altura(['spring'])).toBeGreaterThan(altura([]) + 4);
  });

  it('la capa guarda más tiempo un toque dado antes de aterrizar', () => {
    const inicial = { ...createRun([{ kind: 'pawn', color: 'w' }], ANCHO, difficultyForLevel(1), modifiersFor(['cloak'])), untilSpawn: 99999 };
    const enElAire = avanzar(jump(inicial).state, 0.5);
    const doble = jump(avanzar(jump(enElAire).state, 0.1)).state;

    expect(doble.jumpBuffer).toBe(modifiersFor(['cloak']).inputBuffer);
    expect(modifiersFor(['cloak']).inputBuffer).toBeGreaterThan(RUNNER_PHYSICS_BUFFER);
  });

  it('el olfato coge las galletas desde más lejos', () => {
    const cogidas = (poderes: Parameters<typeof modifiersFor>[0]) => {
      // Una galleta que pasa justo por encima de la cabeza (3 px por encima de lo que alcanza normalmente)
      let state: RunnerState = { ...conPoderes(poderes), untilSpawn: 99999, queue: [{ kind: 'pawn', color: 'w' }] };
      state = { ...state, pickups: [{ id: 1, x: CONTACT_X + 10, y: 29 }] };
      let total = 0;
      for (let i = 0; i < 400; i++) {
        const paso = stepRun(state, PASO);
        state = paso.state;
        total += paso.events.cookies;
      }
      return total;
    };

    expect(cogidas([])).toBe(0);
    expect(cogidas(['nose'])).toBe(1);
  });

  it('con poderes, un jugador atento sigue pasando toda carrera: las ayudas no estorban', () => {
    const todos = ['nose', 'spring', 'shield', 'trail', 'ghost', 'dodge', 'heart', 'net', 'cloak', 'crown'] as const;
    const piezas = buildRunnerSequence('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'ej-1', 5);
    const r = carreraDelBotGeneral(piezas, [...todos], 5);

    expect(r.stumbles).toBe(0);
    expect(r.cleared).toBe(piezas.length);
  });

  /** Un bot atento, con los poderes dados. */
  function carreraDelBotGeneral(piezas: RunnerPiece[], poderes: Parameters<typeof modifiersFor>[0], nivel = 1) {
    let state = createRun(piezas, ANCHO, difficultyForLevel(nivel), modifiersFor(poderes));
    const hecho = new Set<number>();
    let t = 0;
    while (state.phase !== 'done' && t < 90) {
      const delante = state.obstacles.find((o) => !o.hit && !o.cleared && !hecho.has(o.id));
      if (delante && (delante.plan - CONTACT_X) / state.speed <= (delante.count > 1 ? 0.2 : 0.28)) {
        hecho.add(delante.id);
        state = jump(state).state;
        if (delante.count > 1) {
          state = jump(state).state;
        }
      }
      state = stepRun(state, PASO).state;
      t += PASO;
    }
    return state;
  }
});

const RUNNER_PHYSICS_BUFFER = P.inputBuffer;

describe('runnerStats', () => {
  it('cuenta los obstáculos, los tropiezos, la duración, los metros y las galletas', () => {
    const r = correr(createRun([{ kind: 'pawn', color: 'w' }], ANCHO));
    const stats = runnerStats(r.state);

    expect(stats.total).toBe(1);
    expect(stats.stumbles).toBe(1);
    expect(stats.clean).toBe(false);
    expect(stats.durationMs).toBeGreaterThan(1000);
    expect(stats.meters).toBe(metersOf(r.state));
    expect(stats.meters).toBeGreaterThan(10);
    expect(stats.cookies).toBe(r.state.cookies);
  });
});
