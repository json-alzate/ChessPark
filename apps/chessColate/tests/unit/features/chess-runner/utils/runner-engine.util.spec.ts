import {
  FIRST_GAP,
  OBSTACLE_SHAPES,
  RUNNER_PHYSICS as P,
} from '@features/chess-runner/config/runner.config';
import { RunnerPiece, RunnerPieceKind, RunnerState } from '@features/chess-runner/models/runner.model';
import {
  boxesOverlap,
  createRun,
  dogBox,
  obstacleBox,
  perform,
  runnerStats,
  stepRun,
} from '@features/chess-runner/utils/runner-engine.util';
import {
  ANCHO,
  carreraDeUno,
  correr,
  Guion,
  PASO,
  ventanasDeAcierto,
} from '@tests/support/chess-runner';

/**
 * El motor del Chess Runner. Las pruebas de «ventanas» barren el instante en que el jugador pulsa y miden
 * cuánto margen deja cada pieza: son las que fijan el equilibrio del juego. Si cambias una medida de
 * `runner.config.ts` y una de estas falla, el juego se ha vuelto injusto o trivial.
 */

/** Pulsar `action` un instante antes de que llegue el obstáculo. */
const solo = (action: 'jump' | 'slide' | 'longJump') => (t: number): Guion => ({ ordenes: [{ t, action }] });

/** Lo que de verdad hace falta para cada pieza. */
const MECANICA: Record<RunnerPieceKind, (t: number) => Guion> = {
  pawn: solo('jump'),
  rook: solo('slide'),
  bishop: solo('longJump'),
  knight: (t) => ({ ordenes: [{ t, action: 'jump' }], mantener: [{ desde: t, hasta: t + 0.9 }] }),
  queen: (t) => ({ ordenes: [{ t, action: 'jump' }, { t: t + 0.3, action: 'jump' }] }),
  king: solo('jump'),
};

describe('física de Chocolate', () => {
  // Con algo en la cola para que la carrera siga «corriendo» (una vacía pasa sola al tramo final y ya no acepta órdenes)
  const nueva = () => ({
    ...createRun([{ kind: 'pawn', color: 'w' }], ANCHO),
    untilSpawn: 99999,
  });

  /** Salta y sigue hasta que aterriza; devuelve la altura máxima y lo que duró el vuelo. */
  function vuelo(action: 'jump' | 'longJump', mantener = false) {
    let state = perform(nueva(), action).state;
    let maxima = 0;
    let t = 0;
    while (state.dog.y > 0 || state.dog.vy > 0) {
      state = stepRun(state, PASO, mantener).state;
      maxima = Math.max(maxima, state.dog.y);
      t += PASO;
    }
    return { maxima, t, state };
  }

  it('un salto sube unos 52 px y dura algo más de medio segundo', () => {
    const { maxima, t } = vuelo('jump');

    expect(maxima).toBeGreaterThan(50);
    expect(maxima).toBeLessThan(54);
    expect(t).toBeGreaterThan(0.64);
    expect(t).toBeLessThan(0.72);
  });

  it('en el suelo no hay vuelo: quieto, la altura y la velocidad siguen en 0', () => {
    const { state } = stepRun(nueva(), 0.5, false);
    expect(state.dog.y).toBe(0);
    expect(state.dog.vy).toBe(0);
  });

  it('aterrizar avisa y devuelve todo a cero', () => {
    let state = perform(nueva(), 'jump').state;
    let aterrizo = false;
    for (let i = 0; i < 400 && !aterrizo; i++) {
      const paso = stepRun(state, PASO, false);
      state = paso.state;
      aterrizo = paso.events.landed;
    }

    expect(aterrizo).toBe(true);
    expect(state.dog).toMatchObject({ y: 0, vy: 0, jumps: 0, hoverLeft: 0, longJump: false });
  });

  it('mantener pulsado en la cima suspende a Chocolate hasta 0,35 s', () => {
    const normal = vuelo('jump', false);
    const flotando = vuelo('jump', true);

    expect(flotando.t - normal.t).toBeGreaterThan(0.3);
    expect(flotando.t - normal.t).toBeLessThan(0.4);
    // No sube más: solo se queda arriba
    expect(flotando.maxima).toBeCloseTo(normal.maxima, 0);
  });

  it('mantener no hace nada mientras sube: solo suspende desde la cima', () => {
    let state = perform(nueva(), 'jump').state;
    for (let i = 0; i < 20; i++) {
      state = stepRun(state, PASO, true).state;
    }
    expect(state.dog.vy).toBeGreaterThan(200);
  });

  it('el salto largo no flota aunque se mantenga pulsado', () => {
    const largo = vuelo('longJump', true);
    const normal = vuelo('jump', false);

    expect(largo.t).toBeCloseTo(normal.t, 1);
  });

  it('el salto largo hace pasar el suelo más rápido mientras dura el vuelo', () => {
    let largo = perform(nueva(), 'longJump').state;
    let normal = perform(nueva(), 'jump').state;
    const antesL = largo.untilSpawn;
    const antesN = normal.untilSpawn;
    largo = stepRun(largo, 0.1, false).state;
    normal = stepRun(normal, 0.1, false).state;

    expect(antesL - largo.untilSpawn).toBeCloseTo((antesN - normal.untilSpawn) * P.longJumpBoost, 3);
  });

  it('un segundo toque en el aire da un segundo impulso, y solo uno', () => {
    let state = perform(nueva(), 'jump').state;
    for (let i = 0; i < 60; i++) state = stepRun(state, PASO, false).state;

    const segundo = perform(state, 'jump');
    expect(segundo.doubleJumped).toBe(true);
    expect(segundo.state.dog.jumps).toBe(2);
    expect(segundo.state.dog.vy).toBe(P.doubleJumpVelocity);

    const tercero = perform(segundo.state, 'jump');
    expect(tercero.doubleJumped).toBe(false);
    expect(tercero.state.dog.vy).toBe(segundo.state.dog.vy);
  });

  it('el doble salto llega más alto que uno simple', () => {
    let doble = perform(nueva(), 'jump').state;
    let maxima = 0;
    for (let i = 0; i < 1000 && (doble.dog.y > 0 || doble.dog.vy > 0); i++) {
      doble = stepRun(doble, PASO, false).state;
      if (i === 70) doble = perform(doble, 'jump').state;
      maxima = Math.max(maxima, doble.dog.y);
    }
    expect(maxima).toBeGreaterThan(vuelo('jump').maxima + 25);
  });

  it('tras un salto largo no hay doble salto', () => {
    let state = perform(nueva(), 'longJump').state;
    for (let i = 0; i < 40; i++) state = stepRun(state, PASO, false).state;

    expect(perform(state, 'jump').doubleJumped).toBe(false);
  });

  it('agacharse dura 0,6 s y baja la altura que puede chocar', () => {
    let state = perform(nueva(), 'slide').state;
    const agachado = dogBox(state.dog);
    expect(state.dog.slide).toBe(P.slideTime);

    state = stepRun(state, 0.7, false).state;
    const erguido = dogBox(state.dog);

    expect(agachado.y1 - agachado.y0).toBe(11);
    expect(erguido.y1 - erguido.y0).toBe(26);
  });

  it('saltar cancela el agache', () => {
    let state = perform(nueva(), 'slide').state;
    state = perform(state, 'jump').state;

    expect(state.dog.slide).toBe(0);
    expect(state.dog.jumps).toBe(1);
  });

  it('agacharse en el aire es caer en picado, y al aterrizar queda agachado', () => {
    let state = perform(nueva(), 'jump').state;
    for (let i = 0; i < 60; i++) state = stepRun(state, PASO, false).state;
    const antes = state.dog.vy;

    state = perform(state, 'slide').state;
    expect(state.dog.vy).toBeLessThanOrEqual(-P.diveVelocity);
    expect(state.dog.vy).toBeLessThan(antes);

    for (let i = 0; i < 400 && state.dog.y > 0; i++) state = stepRun(state, PASO, false).state;
    expect(state.dog.slide).toBeGreaterThan(0);
  });

  describe('orden guardada un instante antes de aterrizar', () => {
    /** Salta y espera hasta que a Chocolate le falten unos `faltan` segundos para tocar el suelo. */
    function aPuntoDeAterrizar(faltan: number) {
      let state = perform(nueva(), 'jump').state;
      for (let i = 0; i < 2000; i++) {
        const { y, vy } = state.dog;
        if (vy < 0 && y / -vy <= faltan) break;
        state = stepRun(state, PASO, false).state;
      }
      return state;
    }

    it('un salto pedido con el doble ya gastado, justo antes de aterrizar, se hace al tocar el suelo', () => {
      let state = aPuntoDeAterrizar(0.4);
      state = perform(state, 'jump').state; // doble salto
      expect(state.dog.jumps).toBe(2);
      // Bajando, a punto de tocar el suelo (dentro de lo que dura la orden guardada)
      for (let i = 0; i < 2000; i++) {
        const { y, vy } = state.dog;
        if (vy < 0 && y / -vy <= 0.08) break;
        state = stepRun(state, PASO, false).state;
      }

      state = perform(state, 'jump').state; // sin más saltos: se guarda
      expect(state.buffer).toMatchObject({ action: 'jump' });
      let saltos = 0;
      for (let i = 0; i < 1000; i++) {
        const paso = stepRun(state, PASO, false);
        state = paso.state;
        saltos += paso.events.jumped ? 1 : 0;
        if (saltos) break;
      }
      expect(saltos).toBe(1);
      expect(state.dog.vy).toBeGreaterThan(0);
    });

    it('una orden de agacharse pedida a tiempo se cumple al aterrizar', () => {
      let state = aPuntoDeAterrizar(0.05);
      state = perform(state, 'slide').state;
      let fin = state;
      for (let i = 0; i < 100 && fin.dog.y > 0; i++) fin = stepRun(fin, PASO, false).state;

      expect(fin.dog.slide).toBeGreaterThan(0);
    });

    it('una orden pedida demasiado pronto caduca y no se hace al aterrizar', () => {
      let state = perform(nueva(), 'jump').state;
      for (let i = 0; i < 20; i++) state = stepRun(state, PASO, false).state;
      state = perform(state, 'longJump').state; // en lo alto y sin poder: se guarda 0,12 s
      expect(state.buffer).not.toBeNull();

      for (let i = 0; i < Math.round(0.2 / PASO); i++) state = stepRun(state, PASO, false).state;

      expect(state.buffer).toBeNull();
    });

    it('un salto largo pedido en el aire se hace al aterrizar si cae dentro del margen', () => {
      let state = aPuntoDeAterrizar(0.06);
      state = perform(state, 'longJump').state;
      let saltos = 0;
      for (let i = 0; i < 100; i++) {
        const paso = stepRun(state, PASO, false);
        state = paso.state;
        saltos += paso.events.jumped ? 1 : 0;
        if (saltos) break;
      }

      expect(saltos).toBe(1);
      expect(state.dog.longJump).toBe(true);
    });
  });

  it('fuera de la carrera las órdenes no hacen nada', () => {
    const terminada: RunnerState = { ...nueva(), phase: 'done' };
    const resultado = perform(terminada, 'jump');

    expect(resultado.jumped).toBe(false);
    expect(resultado.state).toBe(terminada);
  });
});

describe('colisiones', () => {
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

  it('la torre flota: por debajo cabe agachado y no de pie', () => {
    const torre = obstacleBox({ kind: 'rook', x: 40 });
    const dePie = dogBox({ ...createRun([], ANCHO).dog, x: 60 });
    const agachado = dogBox({ ...createRun([], ANCHO).dog, x: 60, slide: 0.5 });

    expect(boxesOverlap(dePie, torre)).toBe(true);
    expect(boxesOverlap(agachado, torre)).toBe(false);
  });
});

describe('equilibrio de cada pieza', () => {
  /** Margen mínimo (en segundos) que debe dejar cada mecánica para que el juego sea justo. */
  const MARGEN_MINIMO: Record<RunnerPieceKind, number> = {
    pawn: 0.2,
    rook: 0.2,
    bishop: 0.25,
    knight: 0.25,
    queen: 0.18,
    king: 0.08,
  };

  it.each(Object.keys(MECANICA) as RunnerPieceKind[])(
    'la mecánica de %s se supera y deja un margen razonable',
    (kind) => {
      const { mejor } = ventanasDeAcierto(kind, MECANICA[kind]);

      expect(mejor).toBeGreaterThanOrEqual(MARGEN_MINIMO[kind]);
    }
  );

  it('el rey es la pieza que pide más precisión', () => {
    const margenes = (Object.keys(MECANICA) as RunnerPieceKind[]).map((kind) => ({
      kind,
      mejor: ventanasDeAcierto(kind, MECANICA[kind]).mejor,
    }));
    const rey = margenes.find((m) => m.kind === 'king')!;

    for (const otra of margenes.filter((m) => m.kind !== 'king')) {
      expect(rey.mejor).toBeLessThan(otra.mejor);
    }
  });

  // Cada pieza se supera con SU mecánica, no con cualquiera
  const EQUIVOCADAS: [RunnerPieceKind, string, (t: number) => Guion][] = [
    ['pawn', 'agacharse', solo('slide')],
    ['rook', 'saltar', solo('jump')],
    ['rook', 'salto largo', solo('longJump')],
    ['bishop', 'saltar', solo('jump')],
    ['bishop', 'agacharse', solo('slide')],
    ['knight', 'saltar sin mantener', solo('jump')],
    ['knight', 'agacharse', solo('slide')],
    ['queen', 'un solo salto', solo('jump')],
    ['queen', 'salto largo', solo('longJump')],
    ['king', 'agacharse', solo('slide')],
  ];

  it.each(EQUIVOCADAS)('la %s no se supera con %s en ningún momento', (kind, _nombre, guion) => {
    expect(ventanasDeAcierto(kind, guion).aciertos).toEqual([]);
  });

  it.each(Object.keys(MECANICA) as RunnerPieceKind[])('sin hacer nada, %s tropieza', (kind) => {
    const r = correr(carreraDeUno(kind));
    expect(r.tropiezos).toBeGreaterThan(0);
  });

  it('el doble salto de la dama no pide un segundo toque en un instante exacto', () => {
    // El segundo toque puede llegar en un abanico de momentos y aun así pasa
    const pasa = [0.2, 0.25, 0.3, 0.35].filter((retraso) => {
      const { aciertos } = ventanasDeAcierto('queen', (t) => ({
        ordenes: [{ t, action: 'jump' }, { t: t + retraso, action: 'jump' }],
      }));
      return aciertos.length > 0;
    });
    expect(pasa.length).toBeGreaterThanOrEqual(3);
  });

  it('el caballo pide mantener un rato: soltar enseguida no basta', () => {
    const { aciertos } = ventanasDeAcierto('knight', (t) => ({
      ordenes: [{ t, action: 'jump' }],
      mantener: [{ desde: t, hasta: t + 0.1 }],
    }));
    expect(aciertos).toEqual([]);
  });
});

describe('tropiezo y reintento', () => {
  it('tropezar suma, hace invulnerable a Chocolate y avisa de qué obstáculo fue', () => {
    let state = carreraDeUno('pawn');
    let tropiezo = null;
    for (let i = 0; i < 1000 && !tropiezo; i++) {
      const paso = stepRun(state, PASO, false);
      state = paso.state;
      tropiezo = paso.events.stumbled;
    }

    expect(tropiezo).toMatchObject({ kind: 'pawn', hit: true, attempt: 0 });
    expect(state.stumbles).toBe(1);
    expect(state.dog.stumble).toBeCloseTo(P.stumbleTime, 1);
  });

  it('la misma pieza reaparece una vez tras tropezar', () => {
    const r = correr(carreraDeUno('pawn'));

    expect(r.tropiezos).toBe(2); // la primera vez y el reintento
    expect(r.state.stumbles).toBe(2);
    expect(r.state.phase).toBe('done');
  });

  it('el reintento lleva la marca de segunda oportunidad', () => {
    let state = carreraDeUno('pawn');
    const intentos = new Set<number>();
    for (let i = 0; i < 6000 && state.phase !== 'done'; i++) {
      state = stepRun(state, PASO, false).state;
      state.obstacles.forEach((o) => intentos.add(o.attempt));
    }

    expect([...intentos].sort()).toEqual([0, 1]);
  });

  it('si en el reintento se acierta, ya no hay más tropiezos y cuenta como superada', () => {
    // Primer intento sin hacer nada; segundo con un salto guionizado por la altura
    let state = carreraDeUno('pawn');
    let primero = false;
    let reintentoSuperado = false;
    let saltado = false;
    for (let i = 0; i < 8000 && state.phase !== 'done'; i++) {
      const delante = state.obstacles.find((o) => !o.hit && !o.cleared);
      if (delante?.attempt === 1 && !saltado && delante.x - (state.dog.x + 15) < 27) {
        state = perform(state, 'jump').state;
        saltado = true;
      }
      const paso = stepRun(state, PASO, false);
      state = paso.state;
      primero = primero || !!paso.events.stumbled;
      reintentoSuperado = reintentoSuperado || paso.events.cleared.some((o) => o.attempt === 1);
    }

    expect(primero).toBe(true);
    expect(reintentoSuperado).toBe(true);
    expect(state.stumbles).toBe(1);
    expect(state.cleared).toBe(1);
  });

  it('tras un segundo tropiezo la carrera sigue: no se queda atascada en una pieza', () => {
    const r = correr(createRun([{ kind: 'pawn', color: 'w' }, { kind: 'rook', color: 'b' }], ANCHO));

    expect(r.state.phase).toBe('done');
    expect(r.t).toBeLessThan(12);
  });

  it('mientras está tropezado no vuelve a chocar con otro obstáculo seguido', () => {
    // Dos peones muy juntos, sin hacer nada: el segundo no cuenta si cae dentro de la invulnerabilidad
    let state: RunnerState = createRun([], ANCHO);
    state = {
      ...state,
      obstacles: [
        // attempt 1: no son reintentables, así que el choque no vuelve a sacar la pieza
        { id: 1, kind: 'pawn', color: 'w', x: 40, attempt: 1, cleared: false, hit: false },
        { id: 2, kind: 'pawn', color: 'w', x: 70, attempt: 1, cleared: false, hit: false },
      ],
    };
    let tropiezos = 0;
    for (let i = 0; i < 600; i++) {
      const paso = stepRun(state, PASO, false);
      state = paso.state;
      tropiezos += paso.events.stumbled ? 1 : 0;
    }

    expect(tropiezos).toBe(1);
  });

  it('un obstáculo que ya chocó no vuelve a chocar ni a contarse', () => {
    let state = carreraDeUno('pawn');
    let choques = 0;
    for (let i = 0; i < 500; i++) {
      const paso = stepRun(state, PASO, false);
      state = paso.state;
      choques += paso.events.stumbled ? 1 : 0;
      if (paso.events.stumbled) break;
    }
    const hit = state.obstacles.find((o) => o.hit)!;
    for (let i = 0; i < 300; i++) {
      const paso = stepRun({ ...state, dog: { ...state.dog, stumble: 0 } }, PASO, false);
      state = paso.state;
    }

    expect(choques).toBe(1);
    expect(hit.cleared).toBe(false);
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
      state = stepRun(state, PASO, false).state;
      t += PASO;
    }

    expect(t).toBeCloseTo(FIRST_GAP / P.speed, 1);
    expect(state.obstacles[0].x).toBeLessThanOrEqual(ANCHO + 10);
    expect(state.obstacles[0].x).toBeGreaterThan(ANCHO);
  });

  it('cada obstáculo sale tras la distancia que pide el siguiente', () => {
    let state = createRun(secuencia, ANCHO);
    const salidas: { id: number; kind: RunnerPieceKind; t: number }[] = [];
    const vistos = new Set<number>();
    let t = 0;
    while (salidas.length < 3 && t < 30) {
      // El suelo corre sin que el jugador haga nada: se anula el choque para medir solo las salidas
      state = { ...stepRun(state, PASO, false).state, dog: { ...state.dog, stumble: 5 } };
      t += PASO;
      for (const o of state.obstacles) {
        if (!vistos.has(o.id)) {
          vistos.add(o.id);
          salidas.push({ id: o.id, kind: o.kind, t });
        }
      }
    }

    // Segundo y tercero: la distancia que recorrió el suelo entre salidas es la `gapBefore` de cada uno
    expect((salidas[1].t - salidas[0].t) * P.speed).toBeCloseTo(OBSTACLE_SHAPES[salidas[1].kind].gapBefore, -1);
    expect((salidas[2].t - salidas[1].t) * P.speed).toBeCloseTo(OBSTACLE_SHAPES[salidas[2].kind].gapBefore, -1);
  });

  it('al superar el último obstáculo Chocolate corre hacia el tablero y la carrera termina', () => {
    const r = correr(createRun([{ kind: 'pawn', color: 'w' }], ANCHO), {
      ordenes: [{ t: FIRST_GAP / P.speed + 0.8, action: 'jump' }],
    });

    expect(r.state.phase).toBe('done');
    expect(r.state.dog.x).toBeGreaterThan(ANCHO);
  });

  it('avisa una vez de que empieza el tramo final y una de que terminó', () => {
    let state = createRun([], ANCHO);
    let finishing = 0;
    let done = 0;
    for (let i = 0; i < 5000 && state.phase !== 'done'; i++) {
      const paso = stepRun(state, PASO, false);
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
    const otra = stepRun(r.state, 1, false);

    expect(otra.state).toBe(r.state);
    expect(otra.events.done).toBe(false);
  });

  it('un jugador que hace lo que pide cada pieza pasa toda la carrera sin tropezar', () => {
    // Bot que decide con la distancia al obstáculo más cercano, no con el reloj: así prueba también
    // que la separación entre piezas deja tiempo de prepararse y de aterrizar
    const ACTUAR_A: Record<RunnerPieceKind, number> = { pawn: 27, rook: 20, bishop: 49, knight: 42, queen: 62, king: 28 };
    let state = createRun(secuencia, ANCHO);
    const hecho = new Set<number>();
    let segundoSalto: number | null = null;
    let mantener = false;
    let t = 0;

    while (state.phase !== 'done' && t < 40) {
      const delante = state.obstacles.find((o) => !o.hit && !o.cleared && !hecho.has(o.id));
      if (delante) {
        const distancia = delante.x - (state.dog.x + 15);
        if (distancia <= ACTUAR_A[delante.kind]) {
          hecho.add(delante.id);
          const accion = { pawn: 'jump', rook: 'slide', bishop: 'longJump', knight: 'jump', queen: 'jump', king: 'jump' }[
            delante.kind
          ] as 'jump' | 'slide' | 'longJump';
          state = perform(state, accion).state;
          if (delante.kind === 'knight') mantener = true;
          if (delante.kind === 'queen') segundoSalto = t + 0.3;
        }
      }
      if (mantener && state.dog.y <= 0 && state.dog.vy <= 0 && state.dog.jumps === 0 && t > 0.1) mantener = false;
      if (segundoSalto !== null && t >= segundoSalto) {
        state = perform(state, 'jump').state;
        segundoSalto = null;
      }
      state = stepRun(state, PASO, mantener).state;
      t += PASO;
    }

    expect(state.phase).toBe('done');
    expect(state.stumbles).toBe(0);
    expect(state.cleared).toBe(secuencia.length);
    expect(runnerStats(state).clean).toBe(true);
  });
});

describe('runnerStats', () => {
  it('cuenta los obstáculos, los tropiezos y la duración', () => {
    const r = correr(createRun([{ kind: 'pawn', color: 'w' }], ANCHO));
    const stats = runnerStats(r.state);

    expect(stats.total).toBe(1);
    expect(stats.stumbles).toBe(2);
    expect(stats.clean).toBe(false);
    expect(stats.durationMs).toBeGreaterThan(1000);
  });
});
