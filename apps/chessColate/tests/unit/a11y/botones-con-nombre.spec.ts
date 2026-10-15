import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';

/**
 * Un botón que solo lleva un icono no tiene nombre para un lector de pantalla: lo anuncia como «botón».
 * Esta prueba recorre las plantillas de la app y de las librerías y exige `aria-label` (o `title`) en
 * todo `<button>` sin texto visible.
 */
const RAIZ = resolve(__dirname, '../../../../..');
const CARPETAS = ['apps/chessColate/src/app', 'libs'];

function plantillas(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    if (nombre === 'node_modules') return [];
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return plantillas(ruta);
    return ruta.endsWith('.html') ? [ruta] : [];
  });
}

/** Texto que ve (o lee) quien usa el botón: sin iconos ni etiquetas, con el `alt` de las imágenes. */
function textoDeUnBoton(interior: string): string {
  return interior
    .replace(/<ion-icon[^>]*>(<\/ion-icon>)?/g, '')
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .replace(/<img[^>]*(\[alt\]|alt="[^"]+")[^>]*>/g, 'ALT')
    .replace(/<[^>]+>/g, '')
    .replace(/@(if|for|else|switch|case|default)[^{]*\{|\}/g, '')
    .replace(/\s+/g, '');
}

describe('accesibilidad · botones con nombre', () => {
  it('ningún botón de las plantillas es solo un icono sin aria-label', () => {
    const sinNombre: string[] = [];

    for (const carpeta of CARPETAS) {
      for (const archivo of plantillas(join(RAIZ, carpeta))) {
        const html = readFileSync(archivo, 'utf-8');
        for (const m of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
          const atributos = m[1];
          if (/aria-label|aria-labelledby|\btitle=|\[title\]/.test(atributos)) continue;
          if (textoDeUnBoton(m[2]) === '') {
            const linea = html.slice(0, m.index).split('\n').length;
            sinNombre.push(`${relative(RAIZ, archivo)}:${linea}`);
          }
        }
      }
    }

    expect(sinNombre).toEqual([]);
  });
});
