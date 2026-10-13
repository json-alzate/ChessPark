import type { Page } from '@playwright/test';

import { PUZZLES } from './fixtures';

/** Un archivo de puzzles ya descargado: un tema × una banda de 20 puntos de elo. */
export interface ArchivoDescargado {
  tema: string;
  desde: number;
}

/** URL real que usa la app para ese tema y banda (ver `buildPuzzleUrl`). */
export function urlDeArchivo({ tema, desde }: ArchivoDescargado): string {
  const primera = tema.charAt(0).toLowerCase();
  const repo = primera <= 'h' ? 'a-h' : primera <= 'o' ? 'i-o' : 'p-z';
  return `https://cdn.jsdelivr.net/gh/json-alzate/chesscolate-puzzles-files-themes-${repo}@main/puzzlesFilesThemes/${tema}/${tema}_${desde}_${desde + 19}.json`;
}

/**
 * Deja archivos de puzzles descargados en IndexedDB (`ChessParkPuzzlesDB`), tal como los
 * guarda `PuzzlesCacheService.cachePuzzles`: el contenido en `puzzlesCache` y la
 * metadata ligera en `puzzlesIndex`. Hay que llamarla con la app ya cargada (así la base
 * existe con sus tablas) y recargar después para que la pantalla lea lo sembrado.
 */
export async function sembrarDescargas(page: Page, archivos: ArchivoDescargado[]): Promise<void> {
  const filas = archivos.map((a) => ({ url: urlDeArchivo(a), tema: a.tema, desde: a.desde }));
  await page.evaluate(
    async ({ filas, puzzles }) => {
      const db = await new Promise<IDBDatabase>((ok, fallo) => {
        const peticion = indexedDB.open('ChessParkPuzzlesDB', 3);
        peticion.onsuccess = () => ok(peticion.result);
        peticion.onerror = () => fallo(peticion.error);
      });
      const ahora = Date.now();
      await new Promise<void>((ok, fallo) => {
        const tx = db.transaction(['puzzlesCache', 'puzzlesIndex'], 'readwrite');
        for (const f of filas) {
          tx.objectStore('puzzlesCache').put({ url: f.url, puzzles, timestamp: ahora, lastAccessedAt: ahora });
          tx.objectStore('puzzlesIndex').put({
            key: f.url,
            timestamp: ahora,
            theme: f.tema,
            eloStart: f.desde,
            eloEnd: f.desde + 19,
            count: puzzles.length,
            sizeBytes: JSON.stringify(puzzles).length,
          });
        }
        tx.oncomplete = () => ok();
        tx.onerror = () => fallo(tx.error);
      });
      db.close();
    },
    { filas, puzzles: PUZZLES }
  );
}

/** Cuántos archivos hay en las dos tablas de la caché de puzzles: [contenido, índice]. */
export async function contarDescargas(page: Page): Promise<[number, number]> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((ok, fallo) => {
      const peticion = indexedDB.open('ChessParkPuzzlesDB', 3);
      peticion.onsuccess = () => ok(peticion.result);
      peticion.onerror = () => fallo(peticion.error);
    });
    const contar = (tabla: string) =>
      new Promise<number>((ok, fallo) => {
        const r = db.transaction(tabla, 'readonly').objectStore(tabla).count();
        r.onsuccess = () => ok(r.result);
        r.onerror = () => fallo(r.error);
      });
    const resultado: [number, number] = [await contar('puzzlesCache'), await contar('puzzlesIndex')];
    db.close();
    return resultado;
  });
}
