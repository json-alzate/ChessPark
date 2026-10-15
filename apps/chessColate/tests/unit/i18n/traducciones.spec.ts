import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';

/**
 * Las traducciones son dos archivos que se editan a mano: una clave que falta en un idioma, un marcador
 * `{{x}}` que no coincide o una clave usada en el código que no existe salen en pantalla como la propia
 * clave (`TRAINING.noPuzzles.title`). Estas pruebas lo atrapan antes de llegar a nadie.
 */
const RAIZ = resolve(__dirname, '../../../../..');
const I18N = join(RAIZ, 'apps/chessColate/src/assets/i18n');
const CARPETAS_CODIGO = ['apps/chessColate/src/app', 'libs'];

type Arbol = { [clave: string]: string | Arbol };

function aplanar(arbol: Arbol, prefijo = ''): Record<string, string> {
  return Object.entries(arbol).reduce<Record<string, string>>((acc, [clave, valor]) => {
    const ruta = prefijo ? `${prefijo}.${clave}` : clave;
    return typeof valor === 'string' ? { ...acc, [ruta]: valor } : { ...acc, ...aplanar(valor, ruta) };
  }, {});
}

const leer = (idioma: string) => aplanar(JSON.parse(readFileSync(join(I18N, `${idioma}.json`), 'utf-8')));
const es = leer('es');
const en = leer('en');

function archivosDeCodigo(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    if (nombre === 'node_modules') return [];
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return archivosDeCodigo(ruta);
    return /\.(ts|html)$/.test(ruta) && !/\.spec\.ts$/.test(ruta) ? [ruta] : [];
  });
}

const marcadores = (texto: string) => (texto.match(/{{\s*\w+\s*}}/g) ?? []).map((m) => m.replace(/\s/g, '')).sort();

describe('traducciones', () => {
  it('es y en tienen exactamente las mismas claves', () => {
    expect(Object.keys(es).filter((k) => !(k in en))).toEqual([]);
    expect(Object.keys(en).filter((k) => !(k in es))).toEqual([]);
  });

  it('cada clave lleva los mismos marcadores {{x}} en los dos idiomas', () => {
    const distintas = Object.keys(es).filter((k) => k in en && marcadores(es[k]).join() !== marcadores(en[k]).join());
    expect(distintas).toEqual([]);
  });

  it('ninguna clave escrita en el código o las plantillas falta en las traducciones', () => {
    const usadas = new Map<string, string>();
    for (const carpeta of CARPETAS_CODIGO) {
      for (const archivo of archivosDeCodigo(join(RAIZ, carpeta))) {
        const texto = readFileSync(archivo, 'utf-8');
        for (const m of texto.matchAll(/['"`]([A-Z][A-Z0-9_]+(?:\.[A-Za-z0-9_]+)+)['"`]/g)) {
          if (!usadas.has(m[1])) usadas.set(m[1], relative(RAIZ, archivo));
        }
      }
    }
    const faltan = [...usadas]
      .filter(([clave]) => !(clave in es) && !Object.keys(es).some((k) => k.startsWith(`${clave}.`)))
      .map(([clave, archivo]) => `${clave} (${archivo})`);
    expect(faltan).toEqual([]);
  });
});
