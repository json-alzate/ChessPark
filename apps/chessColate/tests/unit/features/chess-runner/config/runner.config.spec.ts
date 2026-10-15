import {
  GESTURE_DECISION_MS,
  GESTURE_MAX_WAIT_MS,
  GESTURE_SLOP_PX,
  GESTURE_SWIPE_PX,
  MAX_OBSTACLES,
  MAX_PER_KIND,
  OBSTACLE_SHAPES,
  RUNNER_CANVAS_HEIGHT,
  RUNNER_PHYSICS,
} from '@features/chess-runner/config/runner.config';

/**
 * La configuración del Chess Runner cruzada con los assets y las traducciones: un nombre que no existe
 * no rompe nada hasta que el juego intenta pintarlo.
 */

declare const __dirname: string;
declare const require: (modulo: string) => any;
const { readFileSync, readdirSync, statSync, existsSync } = require('fs') as {
  readFileSync(ruta: string, codificacion: string): string;
  readdirSync(ruta: string): string[];
  statSync(ruta: string): { isDirectory(): boolean };
  existsSync(ruta: string): boolean;
};
const { join } = require('path') as { join(...partes: string[]): string };

const RAIZ_SRC = join(__dirname, '../../../../../src');
const CARPETA = join(RAIZ_SRC, 'app/features/chess-runner');
const ASSETS = join(RAIZ_SRC, 'assets/images/runner');

type Textos = { [clave: string]: string | Textos };
const textos = (idioma: 'es' | 'en'): Textos =>
  JSON.parse(readFileSync(join(RAIZ_SRC, 'assets/i18n', `${idioma}.json`), 'utf-8'));
const existe = (arbol: Textos, clave: string): boolean => {
  let actual: string | Textos | undefined = arbol;
  for (const parte of clave.split('.')) {
    if (typeof actual !== 'object' || actual === null) return false;
    actual = actual[parte];
  }
  return typeof actual === 'string';
};
const archivos = (carpeta: string): string[] =>
  readdirSync(carpeta).flatMap((nombre) => {
    const ruta = join(carpeta, nombre);
    return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
  });

const PIEZAS = Object.keys(OBSTACLE_SHAPES);

describe('configuración del Chess Runner', () => {
  it('hay una forma para cada una de las seis piezas', () => {
    expect(PIEZAS.sort()).toEqual(['bishop', 'king', 'knight', 'pawn', 'queen', 'rook']);
  });

  it('cada forma tiene medidas positivas y una pista', () => {
    for (const [kind, forma] of Object.entries(OBSTACLE_SHAPES)) {
      expect(forma.width).toBeGreaterThan(0);
      expect(forma.height).toBeGreaterThan(0);
      expect(forma.bottom).toBeGreaterThanOrEqual(0);
      expect(forma.gapBefore).toBeGreaterThan(100);
      expect(forma.hint).toBeTruthy();
      void kind;
    }
  });

  it('solo la torre flota: el resto está pegado al suelo', () => {
    for (const [kind, forma] of Object.entries(OBSTACLE_SHAPES)) {
      expect(forma.bottom > 0).toBe(kind === 'rook');
    }
  });

  it('lo que choca nunca es más ancho que el dibujo de la pieza', () => {
    const anchoDelDibujo: Record<string, number> = { pawn: 18, rook: 22, bishop: 48, knight: 30, queen: 22, king: 20 };
    for (const [kind, forma] of Object.entries(OBSTACLE_SHAPES)) {
      expect(forma.width).toBeLessThanOrEqual(anchoDelDibujo[kind]);
    }
  });

  it('lo que choca nunca es más alto que el dibujo de la pieza', () => {
    const altoDelDibujo: Record<string, number> = { pawn: 24, rook: 30, bishop: 26, knight: 40, queen: 60, king: 46 };
    for (const [kind, forma] of Object.entries(OBSTACLE_SHAPES)) {
      expect(forma.height).toBeLessThanOrEqual(altoDelDibujo[kind]);
    }
  });

  it('el doble salto de la dama cabe en el lienzo, cabeza incluida', () => {
    const { jumpVelocity, doubleJumpVelocity, gravity } = RUNNER_PHYSICS;
    const subida = (v: number) => (v * v) / (2 * gravity);
    // Segundo impulso justo en la cima, que es lo más alto que se puede llegar
    const maxima = subida(jumpVelocity) + subida(doubleJumpVelocity);
    const ALTO_DE_CHOCOLATE = 40;
    const PIES_SOBRE_EL_LIENZO = RUNNER_CANVAS_HEIGHT - 26; // los pies apoyan a 26 px del borde de abajo

    expect(maxima + ALTO_DE_CHOCOLATE).toBeLessThan(PIES_SOBRE_EL_LIENZO);
  });

  it('el máximo de obstáculos y de copias por pieza tienen sentido', () => {
    expect(MAX_OBSTACLES).toBeGreaterThanOrEqual(6);
    expect(MAX_PER_KIND).toBeGreaterThanOrEqual(1);
    expect(MAX_OBSTACLES).toBeLessThanOrEqual(12);
  });

  it('los umbrales del gesto van de menor a mayor', () => {
    expect(GESTURE_SLOP_PX).toBeLessThan(GESTURE_SWIPE_PX);
    expect(GESTURE_DECISION_MS).toBeLessThan(GESTURE_MAX_WAIT_MS);
  });
});

describe('assets y traducciones del Chess Runner', () => {
  it('existe el sprite de cada pieza en los dos bandos y la pista de cada mecánica', () => {
    for (const kind of PIEZAS) {
      for (const lado of ['w', 'b']) {
        expect(existsSync(join(ASSETS, `piece-${kind}-${lado}.png`))).toBe(true);
      }
      expect(existsSync(join(ASSETS, `hint-${OBSTACLE_SHAPES[kind as keyof typeof OBSTACLE_SHAPES].hint}.png`))).toBe(true);
    }
  });

  it('existen las poses de Chocolate, el escenario y el manifiesto', () => {
    for (const nombre of ['dog-run', 'dog-jump', 'dog-slide', 'dog-hurt', 'dog-happy', 'scene-floor', 'scene-hills', 'scene-sky', 'runner']) {
      expect(existsSync(join(ASSETS, nombre === 'runner' ? 'runner.json' : `${nombre}.png`))).toBe(true);
    }
  });

  it('el manifiesto describe los sprites que el juego pide por nombre', () => {
    const manifiesto = JSON.parse(readFileSync(join(ASSETS, 'runner.json'), 'utf-8')).sprites;
    expect(manifiesto['dog-run'].frames).toBe(4);
    expect(manifiesto['dog-jump'].frames).toBe(3);
    expect(manifiesto['scene-sky']).toBeDefined();
  });

  const claves = (() => {
    const set = new Set<string>();
    for (const ruta of archivos(CARPETA)) {
      if (!/\.(html|ts)$/.test(ruta)) continue;
      for (const [, clave] of readFileSync(ruta, 'utf-8').matchAll(/'(CHESS_RUNNER\.[A-Za-z0-9_.]+[A-Za-z0-9_])'/g)) {
        set.add(clave);
      }
    }
    return [...set];
  })();
  const dinamicas = [
    ...PIEZAS.flatMap((kind) => [`CHESS_RUNNER.pieces.${kind}.name`, `CHESS_RUNNER.pieces.${kind}.how`]),
    ...['solved', 'wrong', 'timeout'].map((r) => `CHESS_RUNNER.result.${r}`),
  ];

  it('las plantillas usan claves (no es una prueba vacía)', () => {
    expect(claves.length).toBeGreaterThan(15);
  });

  for (const idioma of ['es', 'en'] as const) {
    it(`todas las claves que usa la funcionalidad existen en ${idioma}`, () => {
      const arbol = textos(idioma);
      expect([...claves, ...dinamicas].filter((c) => !existe(arbol, c))).toEqual([]);
    });
  }

  it('es y en tienen las mismas claves, y no sobra ninguna', () => {
    const planas = (arbol: Textos, prefijo = ''): string[] =>
      Object.entries(arbol).flatMap(([k, v]) => (typeof v === 'string' ? [`${prefijo}${k}`] : planas(v, `${prefijo}${k}.`)));
    const es = planas(textos('es')['CHESS_RUNNER'] as Textos, 'CHESS_RUNNER.').sort();
    const en = planas(textos('en')['CHESS_RUNNER'] as Textos, 'CHESS_RUNNER.').sort();
    expect(en).toEqual(es);

    const usadas = new Set([...claves, ...dinamicas]);
    expect(es.filter((c) => !usadas.has(c))).toEqual([]);
  });

  it('los textos no llevan guiones largos ni emojis (guía de tono)', () => {
    const todo: string[] = [];
    const recorrer = (arbol: Textos) => Object.values(arbol).forEach((v) => (typeof v === 'string' ? todo.push(v) : recorrer(v)));
    recorrer(textos('es')['CHESS_RUNNER'] as Textos);
    recorrer(textos('en')['CHESS_RUNNER'] as Textos);
    expect(todo.filter((t) => t.includes('—'))).toEqual([]);
    expect(todo.filter((t) => /\p{Extended_Pictographic}/u.test(t))).toEqual([]);
  });
});
