import {
  COOKIE_SIZE,
  difficultyForLevel,
  OBSTACLE_SHAPES,
  PIECE_BEHAVIOR,
  PIECE_DRAW_SIZE,
  worldOfLevel,
  WORLDS,
} from '@features/chess-runner/config/runner.config';
import { RunnerRenderer, FEET_Y } from '@features/chess-runner/components/runner-canvas/runner-renderer';
import { RunnerObstacle, RunnerState } from '@features/chess-runner/models/runner.model';
import { RunnerSprite } from '@features/chess-runner/services/runner-sprites.service';
import { createRun } from '@features/chess-runner/utils/runner-engine.util';

/**
 * El pintor del runner: recibe un estado y dibuja. El contexto 2D es un doble que anota las llamadas
 * (jsdom no dibuja), así que se comprueba qué se pinta, no cómo se ve.
 */

const ANCHO = 200;

function sprite(frameW: number, frameH: number, frames = 1, image = {} as CanvasImageSource): RunnerSprite {
  return { image, frameW, frameH, frames, fps: 8 };
}

function contexto() {
  return {
    imageSmoothingEnabled: true,
    globalAlpha: 1,
    clearRect: jest.fn(),
    drawImage: jest.fn(),
    fillRect: jest.fn(),
    strokeRect: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    translate: jest.fn(),
  } as unknown as CanvasRenderingContext2D & {
    clearRect: jest.Mock;
    drawImage: jest.Mock;
    fillRect: jest.Mock;
    strokeRect: jest.Mock;
    save: jest.Mock;
    restore: jest.Mock;
    translate: jest.Mock;
  };
}

const IMAGEN_PERRO = { id: 'perro' } as unknown as CanvasImageSource;
const IMAGEN_PEON = { id: 'peon' } as unknown as CanvasImageSource;
const IMAGEN_TORRE = { id: 'torre' } as unknown as CanvasImageSource;
const IMAGEN_REY = { id: 'rey' } as unknown as CanvasImageSource;
const IMAGEN_POLVO = { id: 'polvo' } as unknown as CanvasImageSource;

function sprites(): Map<string, RunnerSprite> {
  return new Map([
    ['dog-run', sprite(52, 40, 4, IMAGEN_PERRO)],
    ['fx-dust', sprite(12, 8, 3, IMAGEN_POLVO)],
  ]);
}

/** Las piezas del set elegido por el usuario: solo las que usan las pruebas. */
function piezas(): Map<string, CanvasImageSource> {
  return new Map([
    ['wp', IMAGEN_PEON],
    ['wr', IMAGEN_TORRE],
    ['bk', IMAGEN_REY],
  ]);
}

/** Un obstáculo a la vista, de las medidas de su pieza. */
function obstaculo(kind: RunnerObstacle['kind'], x: number, extra: Partial<RunnerObstacle> = {}): RunnerObstacle {
  const forma = OBSTACLE_SHAPES[kind];
  return {
    id: 1,
    kind,
    color: 'w',
    plan: x,
    x,
    y: PIECE_BEHAVIOR[kind].lift,
    width: forma.width,
    height: forma.height,
    count: 1,
    spacing: 0,
    cleared: false,
    hit: false,
    ...extra,
  };
}

/** Una carrera con un peón que ya salió y está a la vista, por delante de Chocolate. */
function estadoConPeon(): RunnerState {
  const inicial = createRun([{ kind: 'pawn', color: 'w' }], ANCHO);
  return { ...inicial, obstacles: [obstaculo('pawn', 120)] };
}

const imagenesDibujadas = (ctx: { drawImage: jest.Mock }) => ctx.drawImage.mock.calls.map((c) => c[0]);

describe('RunnerRenderer', () => {
  let ctx: ReturnType<typeof contexto>;
  let pintor: RunnerRenderer;

  beforeEach(() => {
    ctx = contexto();
    pintor = new RunnerRenderer(ctx, sprites(), piezas(), ANCHO);
  });

  it('limpia el lienzo y apaga el suavizado para que el pixel art quede nítido', () => {
    pintor.draw(estadoConPeon());

    expect(ctx.imageSmoothingEnabled).toBe(false);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, ANCHO, expect.any(Number));
  });

  it('dibuja a Chocolate y el obstáculo que tiene delante', () => {
    pintor.draw(estadoConPeon());

    expect(imagenesDibujadas(ctx)).toEqual(expect.arrayContaining([IMAGEN_PERRO, IMAGEN_PEON]));
  });

  it('un obstáculo con el que ya se chocó se pinta apagado', () => {
    const estado = estadoConPeon();
    estado.obstacles[0].hit = true;
    const alfas: number[] = [];
    ctx.drawImage.mockImplementation((imagen: CanvasImageSource) => {
      if (imagen === IMAGEN_PEON) {
        alfas.push(ctx.globalAlpha);
      }
    });

    pintor.draw(estado);

    expect(alfas).toHaveLength(1);
    expect(alfas[0]).toBeLessThan(1);
    expect(ctx.globalAlpha).toBe(1);
  });

  it('pinta cada pieza con la imagen de su bando y su tipo en el set elegido', () => {
    const estado = estadoConPeon();
    estado.obstacles.push(obstaculo('king', 160, { id: 2, color: 'b' }));

    pintor.draw(estado);

    expect(imagenesDibujadas(ctx)).toEqual(expect.arrayContaining([IMAGEN_PEON, IMAGEN_REY]));
  });

  it('las piezas se dibujan al tamaño del cuadro y suavizadas (son vectoriales)', () => {
    const suavizado: boolean[] = [];
    ctx.drawImage.mockImplementation((imagen: CanvasImageSource) => {
      if (imagen === IMAGEN_PEON) {
        suavizado.push(ctx.imageSmoothingEnabled);
      }
    });

    pintor.draw(estadoConPeon());

    const llamada = ctx.drawImage.mock.calls.find((c) => c[0] === IMAGEN_PEON) as unknown[];
    expect(llamada.slice(3, 5)).toEqual([PIECE_DRAW_SIZE, PIECE_DRAW_SIZE]);
    expect(suavizado).toEqual([true]);
    // Y al terminar vuelve el pixel art nítido para lo siguiente
    expect(ctx.imageSmoothingEnabled).toBe(false);
  });

  it('si el set no tiene esa pieza no se dibuja, pero la carrera sigue', () => {
    const estado = estadoConPeon();
    estado.obstacles[0].kind = 'queen';

    expect(() => pintor.draw(estado)).not.toThrow();
    expect(imagenesDibujadas(ctx)).not.toContain(IMAGEN_PEON);
  });

  it('un efecto se anima cuadro a cuadro y desaparece al terminar su animación', () => {
    const estado = estadoConPeon();
    pintor.addFx('dust', 50, 0, 0);

    pintor.draw({ ...estado, time: 0 });
    const polvo = ctx.drawImage.mock.calls.filter((c) => c[0] === IMAGEN_POLVO);
    expect(polvo).toHaveLength(1);
    // Recorte del primer cuadro, apoyado en el suelo
    expect(polvo[0][1]).toBe(0);
    expect(polvo[0][6]).toBe(Math.round(FEET_Y - 8));

    // 3 cuadros a 8 fps: a los 0,5 s ya acabó y no se vuelve a dibujar
    ctx.drawImage.mockClear();
    pintor.draw({ ...estado, time: 0.5 });
    pintor.draw({ ...estado, time: 0.6 });
    expect(imagenesDibujadas(ctx)).not.toContain(IMAGEN_POLVO);
  });

  it('un efecto sin sprite cargado se descarta sin romper el dibujo', () => {
    const sinChispa = new RunnerRenderer(ctx, sprites(), piezas(), ANCHO);
    sinChispa.addFx('spark', 50, 0, 0);

    expect(() => sinChispa.draw(estadoConPeon())).not.toThrow();
  });

  it('sin los sprites ni las piezas cargados dibuja lo que puede en vez de fallar', () => {
    const vacio = new RunnerRenderer(ctx, new Map(), new Map(), ANCHO);

    expect(() => vacio.draw(estadoConPeon())).not.toThrow();
  });

  it('al cambiar el ancho limpia el lienzo con el ancho nuevo', () => {
    pintor.resize(320);
    pintor.draw(estadoConPeon());

    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 320, expect.any(Number));
  });

  describe('sensación de velocidad y de golpe', () => {
    it('un tropiezo sacude la escena y la deja como estaba (guardar y restaurar van a la par)', () => {
      const estado = estadoConPeon();
      pintor.draw({ ...estado, dog: { ...estado.dog, stumble: 0.9 } });

      expect(ctx.save).toHaveBeenCalledTimes(1);
      expect(ctx.translate).toHaveBeenCalledTimes(1);
      expect(ctx.restore).toHaveBeenCalledTimes(1);
    });

    it('con el perro ya recuperado la escena no se mueve', () => {
      const estado = estadoConPeon();
      pintor.draw({ ...estado, dog: { ...estado.dog, stumble: 0.3 } });

      expect(ctx.save).not.toHaveBeenCalled();
      expect(ctx.translate).not.toHaveBeenCalled();
    });

    it('a mayor nivel y velocidad se dibujan más rayitas de velocidad en el aire', () => {
      /** Cuántos rectángulos blancos translúcidos (las rayitas) pinta un fotograma. */
      const rayitas = (nivel: number, avance: number) => {
        const lienzo = contexto() as ReturnType<typeof contexto> & { fillStyle: string };
        let trazadas = 0;
        lienzo.fillRect.mockImplementation(() => {
          trazadas += /^rgba\(255, 255, 255/.test(lienzo.fillStyle) ? 1 : 0;
        });
        const dificultad = difficultyForLevel(nivel);
        new RunnerRenderer(lienzo, sprites(), piezas(), ANCHO).draw({
          ...estadoConPeon(),
          difficulty: dificultad,
          speed: dificultad.startSpeed + avance,
          distance: 40,
        });
        return trazadas;
      };

      expect(rayitas(1, 0)).toBe(0);
      expect(rayitas(6, 40)).toBeGreaterThan(rayitas(2, 0));
      expect(rayitas(2, 0)).toBeGreaterThan(0);
    });
  });
});

describe('RunnerRenderer: piezas, galletas y mundos', () => {
  let ctx: ReturnType<typeof contexto> & { fillStyle: string };
  let pintor: RunnerRenderer;
  const colores: string[] = [];

  beforeEach(() => {
    ctx = contexto() as ReturnType<typeof contexto> & { fillStyle: string };
    colores.length = 0;
    ctx.fillRect.mockImplementation(() => colores.push(ctx.fillStyle));
    pintor = new RunnerRenderer(ctx, sprites(), piezas(), ANCHO);
  });

  const dibujaPeon = (obstacles: RunnerObstacle[], nivel = 1) => {
    ctx.drawImage.mockClear();
    pintor.draw({ ...estadoConPeon(), obstacles, difficulty: difficultyForLevel(nivel) });
    return ctx.drawImage.mock.calls.filter((c) => c[0] === IMAGEN_PEON);
  };

  it('una falange dibuja sus tres piezas, separadas', () => {
    const llamadas = dibujaPeon([obstaculo('pawn', 120, { count: 3, spacing: 30, width: 68 })]);

    expect(llamadas).toHaveLength(3);
    const xs = llamadas.map((c) => c[1] as number);
    expect(xs[1] - xs[0]).toBe(30);
    expect(xs[2] - xs[1]).toBe(30);
  });

  it('una pieza que flota se dibuja más arriba que una de suelo, y la sombra se queda en el suelo', () => {
    const suelo = dibujaPeon([obstaculo('pawn', 120)])[0][2] as number;
    const flotando = dibujaPeon([obstaculo('pawn', 120, { y: 8 })])[0][2] as number;

    expect(flotando).toBe(suelo - 8);
  });

  it('una torre que se desliza deja una estela blanca detrás', () => {
    pintor.draw({ ...estadoConPeon(), obstacles: [obstaculo('rook', 100)] });

    expect(colores.filter((c) => c === 'rgba(255, 255, 255, 0.35)').length).toBe(3);
  });

  it('las demás piezas no dejan estela', () => {
    pintor.draw(estadoConPeon());

    expect(colores).not.toContain('rgba(255, 255, 255, 0.35)');
  });

  it('una galleta se dibuja con su pixel art (masa, borde y chispas de chocolate)', () => {
    pintor.draw({ ...estadoConPeon(), pickups: [{ id: 1, x: 100, y: 40 }] });

    for (const color of ['#d99a52', '#6b3d17', '#3a1f0c', '#f2c987']) {
      expect(colores).toContain(color);
    }
    // 9×9 menos las esquinas vacías
    expect(colores.filter((c) => c === '#d99a52').length).toBeGreaterThan(20);
    expect(COOKIE_SIZE).toBe(9);
  });

  it('el día no se tiñe; la tarde, la noche y el amanecer sí', () => {
    const tintes = (nivel: number) => {
      colores.length = 0;
      pintor.draw({ ...estadoConPeon(), difficulty: difficultyForLevel(nivel) });
      return colores.filter((c) => /^rgba\((255, 130, 50|12, 20, 70|255, 120, 175)/.test(c));
    };

    expect(tintes(1)).toHaveLength(0);
    expect(tintes(4)).toEqual(['rgba(255, 130, 50, 0.26)']);
    expect(tintes(7)).toEqual(['rgba(12, 20, 70, 0.58)']);
    expect(tintes(10)).toEqual(['rgba(255, 120, 175, 0.22)']);
  });

  it('de noche hay estrellas', () => {
    pintor.draw({ ...estadoConPeon(), difficulty: difficultyForLevel(7) });
    const estrellas = colores.filter((c) => /^rgba\(255, 255, 255, 0\.(55|95)\)$/.test(c));

    expect(estrellas.length).toBe(10);
  });

  it('hay cuatro escenarios, uno por cada tres niveles', () => {
    expect(WORLDS).toEqual(['day', 'sunset', 'night', 'dawn']);
    expect([1, 3, 4, 6, 7, 9, 10].map((n) => worldOfLevel(n))).toEqual(['day', 'day', 'sunset', 'sunset', 'night', 'night', 'dawn']);
    // Pasada la vuelta, vuelve a empezar
    expect(worldOfLevel(13)).toBe('day');
  });
});
