import {
  WOODPECKER_CYCLES,
  WOODPECKER_DEFAULT_PACE,
  WOODPECKER_DEFAULT_SIZE,
  WOODPECKER_ELO,
  WOODPECKER_PACES,
  WOODPECKER_SIZES,
} from '@features/woodpecker/config/woodpecker.config';

/**
 * La configuración del Pájaro Carpintero es lo que la pantalla ofrece al
 * usuario. Estas pruebas la comprueban por dentro (que lo ofrecido tenga
 * sentido) y la cruzan con las traducciones: un texto que falta no rompe nada
 * hasta que alguien lo ve en pantalla.
 */

// El tsconfig de pruebas solo declara los tipos de jest (sin @types/node): se
// declaran aquí las piezas de Node que hacen falta para leer archivos.
declare const __dirname: string;
declare const require: (modulo: string) => any;
const { readFileSync, readdirSync, statSync } = require('fs') as {
  readFileSync(ruta: string, codificacion: string): string;
  readdirSync(ruta: string): string[];
  statSync(ruta: string): { isDirectory(): boolean };
};
const { join } = require('path') as { join(...partes: string[]): string };

const RAIZ_SRC = join(__dirname, '../../../../../src');
const CARPETA_FUNCIONALIDAD = join(RAIZ_SRC, 'app/features/woodpecker');

type Textos = { [clave: string]: string | Textos };

function textos(idioma: 'es' | 'en'): Textos {
  return JSON.parse(readFileSync(join(RAIZ_SRC, 'assets/i18n', `${idioma}.json`), 'utf-8'));
}

function existe(arbol: Textos, clave: string): boolean {
  let actual: string | Textos | undefined = arbol;
  for (const parte of clave.split('.')) {
    if (typeof actual !== 'object' || actual === null) {
      return false;
    }
    actual = actual[parte];
  }
  return typeof actual === 'string';
}

function archivos(carpeta: string): string[] {
  return readdirSync(carpeta).flatMap((nombre) => {
    const ruta = join(carpeta, nombre);
    return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
  });
}

describe('configuración del Pájaro Carpintero', () => {
  it('el tamaño por defecto es uno de los que se ofrecen', () => {
    expect(WOODPECKER_SIZES).toContain(WOODPECKER_DEFAULT_SIZE);
  });

  it('los tamaños van de menor a mayor', () => {
    expect([...WOODPECKER_SIZES]).toEqual([...WOODPECKER_SIZES].sort((a, b) => a - b));
  });

  it('las vueltas por defecto caben entre el mínimo y el máximo, y hay al menos dos', () => {
    expect(WOODPECKER_CYCLES.min).toBeGreaterThanOrEqual(2);
    expect(WOODPECKER_CYCLES.default).toBeGreaterThanOrEqual(WOODPECKER_CYCLES.min);
    expect(WOODPECKER_CYCLES.default).toBeLessThanOrEqual(WOODPECKER_CYCLES.max);
  });

  it('el rango de ELO es múltiplo de 100 y cabe en el catálogo', () => {
    expect(WOODPECKER_ELO.min % WOODPECKER_ELO.step).toBe(0);
    expect(WOODPECKER_ELO.max % WOODPECKER_ELO.step).toBe(0);
    expect(WOODPECKER_ELO.minSpan % WOODPECKER_ELO.step).toBe(0);
    expect(WOODPECKER_ELO.max - WOODPECKER_ELO.min).toBeGreaterThan(WOODPECKER_ELO.minSpan);
  });

  it('el ritmo por defecto existe', () => {
    expect(WOODPECKER_PACES[WOODPECKER_DEFAULT_PACE]).toBeDefined();
  });

  it('cada ritmo con reloj arranca con tiempo y baja un porcentaje razonable', () => {
    for (const ritmo of Object.values(WOODPECKER_PACES)) {
      if (ritmo.timing === 'decreasing') {
        expect(ritmo.baseTimePerPuzzleSec).toBeGreaterThan(0);
        expect(ritmo.decreasePercent).toBeGreaterThan(0);
        expect(ritmo.decreasePercent).toBeLessThan(50);
      } else {
        expect(ritmo.baseTimePerPuzzleSec).toBe(0);
      }
    }
  });

  it('los ritmos con reloj se ordenan de más relajado a más intenso', () => {
    expect(WOODPECKER_PACES.intense.baseTimePerPuzzleSec).toBeLessThan(
      WOODPECKER_PACES.standard.baseTimePerPuzzleSec
    );
  });
});

describe('traducciones del Pájaro Carpintero', () => {
  const idiomas = { es: textos('es'), en: textos('en') };

  /** Claves que aparecen escritas tal cual en las plantillas y el código. */
  const clavesEstaticas = (() => {
    const claves = new Set<string>();
    for (const ruta of archivos(CARPETA_FUNCIONALIDAD)) {
      if (!/\.(html|ts)$/.test(ruta)) {
        continue;
      }
      const contenido = readFileSync(ruta, 'utf-8');
      for (const [, clave] of contenido.matchAll(/'(WOODPECKER\.[A-Za-z0-9_.]+[A-Za-z0-9_])'/g)) {
        claves.add(clave);
      }
    }
    return [...claves];
  })();

  /** Claves que se arman en la plantilla con un valor: se listan los valores posibles. */
  const clavesDinamicas = [
    ...['shuffle', 'same', 'reverse'].flatMap((orden) => [
      `WOODPECKER.setup.order.${orden}`,
      `WOODPECKER.setup.order.${orden}Hint`,
    ]),
    ...Object.keys(WOODPECKER_PACES).map((ritmo) => `WOODPECKER.setup.pace.${ritmo}`),
    // Los nombres de grupo vienen del JSON de temas y se traducen si hay clave
    ...['Fases', 'Temas', 'Avanzado', 'Mates', 'Objetivos', 'Duración'].map(
      (grupo) => `WOODPECKER.setup.themes.groups.${grupo}`
    ),
  ];

  it('las plantillas usan claves (no es una prueba vacía)', () => {
    expect(clavesEstaticas.length).toBeGreaterThan(40);
  });

  for (const idioma of ['es', 'en'] as const) {
    it(`todas las claves que usa la funcionalidad existen en ${idioma}`, () => {
      const faltan = [...clavesEstaticas, ...clavesDinamicas].filter(
        (clave) => !existe(idiomas[idioma], clave)
      );
      expect(faltan).toEqual([]);
    });
  }

  it('no sobran claves: todo lo traducido se usa en alguna parte', () => {
    const usadas = new Set([...clavesEstaticas, ...clavesDinamicas]);
    const planas: string[] = [];
    const recorrer = (arbol: Textos, prefijo: string) => {
      for (const [clave, valor] of Object.entries(arbol)) {
        typeof valor === 'string' ? planas.push(`${prefijo}${clave}`) : recorrer(valor, `${prefijo}${clave}.`);
      }
    };
    recorrer(idiomas.es['WOODPECKER'] as Textos, 'WOODPECKER.');

    // Las claves que usan la tarjeta del inicio y el menú viven fuera de la carpeta de la funcionalidad
    const fueraDeLaCarpeta = [
      ...archivos(join(RAIZ_SRC, 'app/features/home')),
      join(RAIZ_SRC, 'app/app.component.ts'),
    ]
      .filter((ruta) => /\.(html|ts)$/.test(ruta))
      .map((ruta) => readFileSync(ruta, 'utf-8'))
      .join('\n');

    const sinUso = planas.filter(
      (clave) => !usadas.has(clave) && !fueraDeLaCarpeta.includes(clave)
    );
    expect(sinUso).toEqual([]);
  });

  it('es y en tienen exactamente las mismas claves', () => {
    const claves = (arbol: Textos, prefijo = ''): string[] =>
      Object.entries(arbol).flatMap(([clave, valor]) =>
        typeof valor === 'string' ? [`${prefijo}${clave}`] : claves(valor, `${prefijo}${clave}.`)
      );
    expect(claves(idiomas.en['WOODPECKER'] as Textos).sort()).toEqual(
      claves(idiomas.es['WOODPECKER'] as Textos).sort()
    );
  });

  it('los textos para el usuario no llevan guiones largos ni emojis (guía de tono)', () => {
    const planos: string[] = [];
    const recorrer = (arbol: Textos) => {
      for (const valor of Object.values(arbol)) {
        typeof valor === 'string' ? planos.push(valor) : recorrer(valor);
      }
    };
    recorrer(idiomas.es['WOODPECKER'] as Textos);
    recorrer(idiomas.en['WOODPECKER'] as Textos);

    expect(planos.filter((texto) => texto.includes('—'))).toEqual([]);
    expect(planos.filter((texto) => /\p{Extended_Pictographic}/u.test(texto))).toEqual([]);
  });
});
