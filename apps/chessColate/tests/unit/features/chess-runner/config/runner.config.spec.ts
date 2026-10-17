import { POWER_IDS } from '@features/chess-runner/campaign/runner-curriculum';
import { DOG_SKINS } from '@features/chess-runner/rendering/dog-skins';
import {
  COOKIE_ARC_Y,
  COOKIE_HIGH_Y,
  COOKIES_PER_HEART,
  difficultyForLevel,
  DOG_BOX,
  MAX_HEARTS,
  MAX_LEVEL,
  MAX_OBSTACLES,
  MAX_PER_KIND,
  MAX_STRIKES,
  PIECE_BEHAVIOR,
  PX_PER_METER,
  WALL_KINDS,
  OBSTACLE_SHAPES,
  PIECE_DRAW_SIZE,
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

  it('cada forma tiene medidas positivas', () => {
    for (const forma of Object.values(OBSTACLE_SHAPES)) {
      expect(forma.width).toBeGreaterThan(0);
      expect(forma.height).toBeGreaterThan(0);
    }
  });

  it('lo que choca cabe dentro del cuadro con que se dibuja la pieza (es indulgente)', () => {
    for (const forma of Object.values(OBSTACLE_SHAPES)) {
      expect(forma.width).toBeLessThanOrEqual(PIECE_DRAW_SIZE);
      expect(forma.height).toBeLessThanOrEqual(PIECE_DRAW_SIZE);
    }
  });

  it('el peón es la más baja y el rey la más alta', () => {
    const alturas = Object.entries(OBSTACLE_SHAPES).map(([kind, forma]) => [kind, forma.height] as const);
    const minima = Math.min(...alturas.map(([, h]) => h));
    const maxima = Math.max(...alturas.map(([, h]) => h));

    expect(OBSTACLE_SHAPES.pawn.height).toBe(minima);
    expect(OBSTACLE_SHAPES.king.height).toBe(maxima);
  });

  it('el salto sube más que la pieza más alta, con holgura', () => {
    const subida = (RUNNER_PHYSICS.jumpVelocity ** 2) / (2 * RUNNER_PHYSICS.gravity);

    expect(subida).toBeGreaterThan(OBSTACLE_SHAPES.king.height + 20);
  });

  it('el salto cabe en el lienzo, cabeza incluida', () => {
    const subida = (RUNNER_PHYSICS.jumpVelocity ** 2) / (2 * RUNNER_PHYSICS.gravity);
    const ALTO_DE_CHOCOLATE = 40;
    const PIES_SOBRE_EL_LIENZO = RUNNER_CANVAS_HEIGHT - 26; // los pies apoyan a 26 px del borde de abajo

    expect(subida + ALTO_DE_CHOCOLATE).toBeLessThan(PIES_SOBRE_EL_LIENZO);
  });

  it('las piezas son más pequeñas que el perrito (40 de alto): no se le comen el protagonismo', () => {
    expect(PIECE_DRAW_SIZE).toBeLessThan(40);
  });

  it('en todos los niveles el menor hueco entre piezas deja tiempo para aterrizar y volver a saltar', () => {
    const vuelo = (2 * RUNNER_PHYSICS.jumpVelocity) / RUNNER_PHYSICS.gravity;

    for (let nivel = 1; nivel <= MAX_LEVEL; nivel++) {
      expect(difficultyForLevel(nivel).minGapTime).toBeGreaterThan(vuelo);
    }
  });

  it('cada pieza tiene su forma de moverse, y todas llegan: ninguna se desliza más lento que el suelo', () => {
    expect(Object.keys(PIECE_BEHAVIOR).sort()).toEqual([...PIEZAS].sort());
    for (const comportamiento of Object.values(PIECE_BEHAVIOR)) {
      expect(comportamiento.slide).toBeGreaterThanOrEqual(1);
      expect(comportamiento.lunge).toBeGreaterThanOrEqual(0);
      expect(comportamiento.lift).toBeGreaterThanOrEqual(0);
    }
  });

  it('solo el alfil flota, y aun así el perrito de pie no pasa por debajo', () => {
    const flotan = Object.entries(PIECE_BEHAVIOR).filter(([, c]) => c.lift > 0).map(([kind]) => kind);

    expect(flotan).toEqual(['bishop']);
    expect(PIECE_BEHAVIOR.bishop.lift).toBeLessThan(DOG_BOX.height);
  });

  it('solo las piezas que no se deslizan forman falange', () => {
    for (const kind of WALL_KINDS) {
      expect(PIECE_BEHAVIOR[kind].slide).toBe(1);
    }
    expect(WALL_KINDS).not.toContain('rook');
    expect(WALL_KINDS).not.toContain('queen');
  });

  it('el doble salto llega más alto que el sencillo, y las galletas de arriba solo con él', () => {
    const subida = (v: number) => v ** 2 / (2 * RUNNER_PHYSICS.gravity);
    const sencillo = subida(RUNNER_PHYSICS.jumpVelocity);
    const doble = sencillo + subida(RUNNER_PHYSICS.doubleJumpVelocity);

    expect(doble).toBeGreaterThan(sencillo + 25);
    // El perrito coge una galleta con la cabeza (su caja es DOG_BOX.height de alto)
    expect(COOKIE_HIGH_Y).toBeGreaterThan(sencillo + DOG_BOX.height);
    expect(COOKIE_HIGH_Y).toBeLessThan(doble + DOG_BOX.height);
    // Las del arco se cogen con un salto sencillo pero no corriendo
    expect(COOKIE_ARC_Y).toBeGreaterThan(DOG_BOX.height);
    expect(COOKIE_ARC_Y).toBeLessThan(sencillo + DOG_BOX.height);
  });

  it('las reglas de la partida: tres corazones, tres fallos y un corazón por varias galletas', () => {
    expect(MAX_HEARTS).toBe(3);
    expect(MAX_STRIKES).toBe(3);
    expect(COOKIES_PER_HEART).toBeGreaterThanOrEqual(10);
    expect(PX_PER_METER).toBeGreaterThan(0);
  });

  it('el máximo de obstáculos y de copias por pieza tienen sentido', () => {
    expect(MAX_OBSTACLES).toBeGreaterThanOrEqual(6);
    expect(MAX_PER_KIND).toBeGreaterThanOrEqual(1);
    expect(MAX_OBSTACLES).toBeLessThanOrEqual(12);
  });
});

describe('assets y traducciones del Chess Runner', () => {
  it('no hay sprites de piezas ni de pistas: las piezas son las del set que el usuario eligió', () => {
    const sobrantes = readdirSync(ASSETS).filter((nombre) => /^(piece|hint)-/.test(nombre));

    expect(sobrantes).toEqual([]);
  });

  it('existe cada set de piezas que ofrece Ajustes', () => {
    // Se lee la tabla de la librería del tablero en vez de importarla: arrastra cm-chessboard, que Jest no carga
    const tabla = readFileSync(join(RAIZ_SRC, '../../../libs/board/src/lib/chessboard-appearance/chessboard-appearance.ts'), 'utf-8');
    const archivos = [...tabla.matchAll(/'pieces\/([a-z-]+\.svg)'/g)].map((m) => m[1]);
    expect(archivos.length).toBeGreaterThanOrEqual(10);
    for (const archivo of archivos) {
      expect(existsSync(join(RAIZ_SRC, 'assets/cm-chessboard/assets/pieces', archivo))).toBe(true);
    }
  });

  it('existen las poses del perrito, el escenario y el manifiesto', () => {
    for (const nombre of ['dog-run', 'dog-jump', 'dog-hurt', 'dog-happy', 'scene-floor', 'scene-hills', 'scene-sky', 'scene-skyline', 'fx-dust', 'fx-spark', 'runner']) {
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
  ...['solved', 'wrong', 'timeout'].map((r) => `CHESS_RUNNER.result.${r}`),
  // El cartel de cada carrera y el motivo del fin de partida se eligen en tiempo de ejecución
  ...['first', 'doubleJump', 'review', 'boss'].map((h) => `CHESS_RUNNER.levelHint.${h}`),
  ...['hits', 'strikes', 'quit', 'lobby'].map((r) => `CHESS_RUNNER.gameOver.${r}`),
  // Cada misión se pide por su tipo
  ...['perfects', 'cookies', 'combo', 'star', 'clean'].map((k) => `CHESS_RUNNER.missions.${k}`),
  // Los pelajes del armario se piden por su identificador
  ...DOG_SKINS.map((skin) => `CHESS_RUNNER.wardrobe.skins.${skin.id}`),
  // El nombre y la explicación de cada poder se piden por su identificador
  ...POWER_IDS.flatMap((id) => [`CHESS_RUNNER.powers.${id}.name`, `CHESS_RUNNER.powers.${id}.desc`]),
  // La etiqueta accesible del mapa y de cada escena de la historia
  ...['prologue', 'intro', 'victory', 'epilogue'].map((e) => `CHESS_RUNNER.story.${e}`),
];

  it('las plantillas usan claves (no es una prueba vacía)', () => {
    expect(claves.length).toBeGreaterThan(10);
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
    // Las frases de las lecciones se piden por patrón y tramo (`lessons.<patrón>.<tramo>`): lo comprueba la prueba de las lecciones
    expect(es.filter((c) => !usadas.has(c) && !c.startsWith('CHESS_RUNNER.lessons.'))).toEqual([]);
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
