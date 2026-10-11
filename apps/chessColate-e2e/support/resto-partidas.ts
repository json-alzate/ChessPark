import type { Page, Route } from '@playwright/test';
import { Chess } from 'chess.js';

/**
 * Datos y simulación de redes para las pruebas de Partidas y de Análisis de partidas.
 *
 * - Partidas de ejemplo con jugadas validadas con chess.js (si una jugada fuera ilegal,
 *   el módulo lanza al cargarse y la prueba falla antes de tocar la app).
 * - `simularChessCom`, `simularLichess` y `simularCatalogoDePartidas` responden con
 *   `page.route` (que tiene prioridad sobre el guardián de red) y anotan cada petición.
 *   Las URLs son las que usan libs/chess-com-provider y libs/lichess-provider.
 */

// — Jugadas ————————————————————————————————————————————————

/** Mate del pastor: ganan las blancas en 7 jugadas. */
export const MATE_DEL_PASTOR = ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#'];
/** Mate del loco: ganan las negras en 4 jugadas. */
export const MATE_DEL_LOCO = ['f3', 'e5', 'g4', 'Qh4#'];
/** Repetición de caballos: tablas. */
export const REPETICION = ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8'];
/** Italiana con 12 jugadas (la abandonan las negras). */
export const ITALIANA = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd4', 'exd4', 'cxd4', 'Bb4+'];

/** Comprueba que las jugadas son legales y devuelve cuántas son. */
function validar(sans: string[]): number {
  const chess = new Chess();
  sans.forEach((san) => chess.move(san));
  return sans.length;
}
[MATE_DEL_PASTOR, MATE_DEL_LOCO, REPETICION, ITALIANA].forEach(validar);

export type Resultado = '1-0' | '0-1' | '1/2-1/2';

/** Texto PGN de una partida, con relojes `{[%clk …]}` tras cada jugada como los de chess.com y lichess. */
export function construirPgn(
  cabeceras: Record<string, string>,
  sans: string[],
  resultado: Resultado,
  conReloj = false
): string {
  validar(sans);
  const lineas = Object.entries({ ...cabeceras, Result: resultado }).map(([k, v]) => `[${k} "${v}"]`);
  const jugadas = sans
    .map((san, i) => {
      const numero = i % 2 === 0 ? `${i / 2 + 1}. ` : '';
      const reloj = conReloj ? ` {[%clk 0:0${9 - Math.floor(i / 2)}:${String(59 - i).padStart(2, '0')}]}` : '';
      return `${numero}${san}${reloj}`;
    })
    .join(' ');
  return `${lineas.join('\n')}\n\n${jugadas} ${resultado}\n`;
}

// — Fechas (el reloj de la prueba está fijado el 2026-10-10) ———————————————————

const utc = (anio: number, mes: number, dia: number, hora = 12) => Date.UTC(anio, mes - 1, dia, hora);

// — chess.com ————————————————————————————————————————————————

export const USUARIO_CHESS_COM = 'jalzate_cc';
export const USUARIO_LICHESS = 'jalzate_li';

interface PartidaChessCom {
  rules?: string;
  mes: [number, number];
  dia: number;
  blancas: [string, number, string];
  negras: [string, number, string];
  tiempo: string;
  sans: string[];
  resultado: Resultado;
  eco: string;
  ecoUrl: string;
}

const PARTIDAS_CHESS_COM: PartidaChessCom[] = [
  {
    // octubre: gana con blancas (rápidas)
    mes: [2026, 10],
    dia: 5,
    blancas: [USUARIO_CHESS_COM, 1210, 'win'],
    negras: ['rival_uno', 1250, 'checkmated'],
    tiempo: '600',
    sans: MATE_DEL_PASTOR,
    resultado: '1-0',
    eco: 'C23',
    ecoUrl: 'https://www.chess.com/openings/Bishops-Opening-Berlin-Defense-3.Qh5',
  },
  {
    // octubre: variante, se ignora
    rules: 'chess960',
    mes: [2026, 10],
    dia: 6,
    blancas: [USUARIO_CHESS_COM, 1100, 'win'],
    negras: ['rival_960', 1100, 'resigned'],
    tiempo: '600',
    sans: MATE_DEL_PASTOR,
    resultado: '1-0',
    eco: 'C20',
    ecoUrl: 'https://www.chess.com/openings/Kings-Pawn-Opening',
  },
  {
    // septiembre: pierde con negras (blitz)
    mes: [2026, 9],
    dia: 12,
    blancas: ['rival_dos', 1300, 'win'],
    negras: [USUARIO_CHESS_COM, 1190, 'checkmated'],
    tiempo: '180+2',
    sans: MATE_DEL_PASTOR,
    resultado: '1-0',
    eco: 'C20',
    ecoUrl: 'https://www.chess.com/openings/Kings-Pawn-Opening',
  },
  {
    // septiembre: tablas con blancas (blitz)
    mes: [2026, 9],
    dia: 20,
    blancas: [USUARIO_CHESS_COM, 1195, 'repetition'],
    negras: ['rival_tres', 1230, 'repetition'],
    tiempo: '300',
    sans: REPETICION,
    resultado: '1/2-1/2',
    eco: 'A06',
    ecoUrl: 'https://www.chess.com/openings/Reti-Opening',
  },
];

/** La partida en el JSON que devuelve `/games/{año}/{mes}` de chess.com. */
function jsonChessCom(p: PartidaChessCom, indice: number) {
  const [anio, mes] = p.mes;
  const pgn = construirPgn(
    {
      Event: 'Live Chess',
      Site: 'Chess.com',
      Date: `${anio}.${String(mes).padStart(2, '0')}.${String(p.dia).padStart(2, '0')}`,
      White: p.blancas[0],
      Black: p.negras[0],
      WhiteElo: String(p.blancas[1]),
      BlackElo: String(p.negras[1]),
      TimeControl: p.tiempo,
      ECO: p.eco,
      ECOUrl: p.ecoUrl,
    },
    p.sans,
    p.resultado,
    true
  );
  return {
    url: `https://www.chess.com/game/live/${anio}${mes}${indice}`,
    uuid: `cc-${anio}-${mes}-${indice}`,
    pgn,
    time_control: p.tiempo,
    end_time: Math.floor(utc(anio, mes, p.dia) / 1000),
    rated: true,
    rules: p.rules ?? 'chess',
    white: { username: p.blancas[0], rating: p.blancas[1], result: p.blancas[2] },
    black: { username: p.negras[0], rating: p.negras[1], result: p.negras[2] },
  };
}

/** Lo que debe salir en pantalla de las partidas de chess.com de prueba (sin la variante). */
export const RESUMEN_CHESS_COM = {
  partidas: 3,
  ganadas: 1,
  tablas: 1,
  perdidas: 1,
  puntuacion: 50,
  rivalMedio: 1260,
  rivales: ['rival_uno', 'rival_dos', 'rival_tres'],
  /** Meses con partidas que sí caen dentro de 3 meses (agosto–octubre de 2026). */
  mesesPedidos: ['2026/09', '2026/10'],
};

export interface OpcionesChessCom {
  /** Usuarios que existen; el resto responden 404. Por defecto, solo `USUARIO_CHESS_COM`. */
  usuarios?: string[];
  /** Mes (`2026/10`) que debe fallar con un 500. */
  mesConError?: string;
  /** Si es true, el perfil existe pero el listado de archivos responde 404. */
  sinArchivo?: boolean;
}

/** URLs que pidió la app a una plataforma, en orden. */
export type Peticiones = string[];

const CORS = { 'access-control-allow-origin': '*' };
const json = (route: Route, cuerpo: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(cuerpo) });

/** Simula `api.chess.com/pub`: perfil, listado de meses y partidas de cada mes. */
export async function simularChessCom(page: Page, opciones: OpcionesChessCom = {}): Promise<Peticiones> {
  const peticiones: Peticiones = [];
  const usuarios = (opciones.usuarios ?? [USUARIO_CHESS_COM]).map((u) => u.toLowerCase());

  await page.route(/^https:\/\/api\.chess\.com\//, (route) => {
    const url = new URL(route.request().url());
    peticiones.push(`${url.pathname}`);
    const m = /^\/pub\/player\/([^/]+)(?:\/(.*))?$/.exec(url.pathname);
    if (!m) {
      return json(route, { message: 'no existe' }, 404);
    }
    const usuario = m[1].toLowerCase();
    const resto = m[2] ?? '';

    if (!usuarios.includes(usuario) && !(opciones.sinArchivo && resto !== '')) {
      return json(route, { code: 0, message: 'User not found' }, 404);
    }
    if (resto === '') {
      return json(route, { username: usuario, player_id: 1 });
    }
    if (opciones.sinArchivo) {
      return json(route, { code: 0, message: 'User not found' }, 404);
    }
    if (resto === 'games/archives') {
      return json(route, {
        archives: [
          'https://api.chess.com/pub/player/' + usuario + '/games/2025/12',
          'https://api.chess.com/pub/player/' + usuario + '/games/2026/09',
          'https://api.chess.com/pub/player/' + usuario + '/games/2026/10',
        ],
      });
    }
    const mes = /^games\/(\d{4})\/(\d{2})$/.exec(resto);
    if (mes) {
      const clave = `${mes[1]}/${mes[2]}`;
      if (opciones.mesConError === clave) {
        return json(route, { message: 'error' }, 500);
      }
      const partidas = PARTIDAS_CHESS_COM.map((p, i) => ({ p, i }))
        .filter(({ p }) => p.mes[0] === Number(mes[1]) && p.mes[1] === Number(mes[2]))
        .map(({ p, i }) => jsonChessCom(p, i));
      return json(route, { games: partidas });
    }
    return json(route, { message: 'no existe' }, 404);
  });

  return peticiones;
}

// — lichess ————————————————————————————————————————————————

interface PartidaLichess {
  id: string;
  fecha: number;
  blancas: [string, number];
  negras: [string, number];
  ganador?: 'white' | 'black';
  estado: string;
  variante?: string;
  reloj?: [number, number];
  sans: string[];
  resultado: Resultado;
  apertura: { eco: string; name: string };
}

const PARTIDAS_LICHESS: PartidaLichess[] = [
  {
    // octubre: gana con negras (blitz)
    id: 'li000001',
    fecha: utc(2026, 10, 6, 15),
    blancas: ['li_rival1', 1480],
    negras: [USUARIO_LICHESS, 1500],
    ganador: 'black',
    estado: 'mate',
    reloj: [300, 0],
    sans: MATE_DEL_LOCO,
    resultado: '0-1',
    apertura: { eco: 'A02', name: 'Bird Opening' },
  },
  {
    // agosto: pierde con blancas (rápidas)
    id: 'li000002',
    fecha: utc(2026, 8, 20, 9),
    blancas: [USUARIO_LICHESS, 1490],
    negras: ['li_rival2', 1510],
    ganador: 'black',
    estado: 'mate',
    reloj: [900, 10],
    sans: MATE_DEL_LOCO,
    resultado: '0-1',
    apertura: { eco: 'A02', name: 'Bird Opening' },
  },
  {
    // septiembre: tablas con blancas (blitz)
    id: 'li000003',
    fecha: utc(2026, 9, 3, 18),
    blancas: [USUARIO_LICHESS, 1495],
    negras: ['li_rival3', 1495],
    estado: 'draw',
    reloj: [180, 2],
    sans: REPETICION,
    resultado: '1/2-1/2',
    apertura: { eco: 'A06', name: 'Zukertort Opening' },
  },
  {
    // variante: se ignora
    id: 'li000004',
    fecha: utc(2026, 10, 7, 10),
    blancas: [USUARIO_LICHESS, 1400],
    negras: ['li_960', 1400],
    ganador: 'white',
    estado: 'resign',
    variante: 'chess960',
    reloj: [300, 0],
    sans: MATE_DEL_PASTOR,
    resultado: '1-0',
    apertura: { eco: 'C20', name: 'King’s Pawn Game' },
  },
  {
    // abortada: se ignora
    id: 'li000005',
    fecha: utc(2026, 10, 8, 10),
    blancas: [USUARIO_LICHESS, 1400],
    negras: ['li_abort', 1400],
    estado: 'aborted',
    reloj: [300, 0],
    sans: ['e4', 'e5'],
    resultado: '1/2-1/2',
    apertura: { eco: 'C20', name: 'King’s Pawn Game' },
  },
];

function lineaLichess(p: PartidaLichess): string {
  const fecha = new Date(p.fecha);
  const pgn = construirPgn(
    {
      Event: 'Rated game',
      Site: `https://lichess.org/${p.id}`,
      Date: `${fecha.getUTCFullYear()}.${String(fecha.getUTCMonth() + 1).padStart(2, '0')}.${String(fecha.getUTCDate()).padStart(2, '0')}`,
      White: p.blancas[0],
      Black: p.negras[0],
      WhiteElo: String(p.blancas[1]),
      BlackElo: String(p.negras[1]),
      TimeControl: p.reloj ? `${p.reloj[0]}+${p.reloj[1]}` : '-',
    },
    p.sans,
    p.resultado,
    true
  );
  return JSON.stringify({
    id: p.id,
    rated: true,
    variant: p.variante ?? 'standard',
    createdAt: p.fecha - 60_000,
    lastMoveAt: p.fecha,
    status: p.estado,
    winner: p.ganador,
    players: {
      white: { user: { name: p.blancas[0], id: p.blancas[0] }, rating: p.blancas[1] },
      black: { user: { name: p.negras[0], id: p.negras[0] }, rating: p.negras[1] },
    },
    opening: p.apertura,
    clock: p.reloj ? { initial: p.reloj[0], increment: p.reloj[1], totalTime: p.reloj[0] + 40 * p.reloj[1] } : undefined,
    pgn,
  });
}

export const RESUMEN_LICHESS = {
  partidas: 3,
  ganadas: 1,
  tablas: 1,
  perdidas: 1,
  puntuacion: 50,
  rivalMedio: 1495,
  rivales: ['li_rival1', 'li_rival2', 'li_rival3'],
};

export interface OpcionesLichess {
  /** Usuarios que existen; el resto responden 404. Por defecto, solo `USUARIO_LICHESS`. */
  usuarios?: string[];
  /** Responder 429 a la descarga de partidas. */
  limitarRitmo?: boolean;
}

/** Simula `lichess.org/api`: perfil y exportación NDJSON de partidas entre dos instantes. */
export async function simularLichess(page: Page, opciones: OpcionesLichess = {}): Promise<Peticiones> {
  const peticiones: Peticiones = [];
  const usuarios = (opciones.usuarios ?? [USUARIO_LICHESS]).map((u) => u.toLowerCase());

  await page.route(/^https:\/\/lichess\.org\/api\//, (route) => {
    const url = new URL(route.request().url());
    peticiones.push(`${url.pathname}${url.search}`);

    const perfil = /^\/api\/user\/([^/]+)$/.exec(url.pathname);
    if (perfil) {
      return usuarios.includes(decodeURIComponent(perfil[1]).toLowerCase())
        ? json(route, { id: perfil[1], username: perfil[1] })
        : json(route, { error: 'Not found' }, 404);
    }

    const partidas = /^\/api\/games\/user\/([^/]+)$/.exec(url.pathname);
    if (partidas) {
      const usuario = decodeURIComponent(partidas[1]).toLowerCase();
      if (!usuarios.includes(usuario)) {
        return json(route, { error: 'Not found' }, 404);
      }
      if (opciones.limitarRitmo) {
        return json(route, { error: 'Too many requests' }, 429);
      }
      const desde = Number(url.searchParams.get('since'));
      const hasta = Number(url.searchParams.get('until'));
      const lineas = PARTIDAS_LICHESS.filter((p) => p.fecha >= desde && p.fecha <= hasta).map(lineaLichess);
      return route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        headers: CORS,
        body: lineas.join('\n') + (lineas.length ? '\n' : ''),
      });
    }
    return json(route, { error: 'Not found' }, 404);
  });

  return peticiones;
}

// — Catálogo de campeones y PGN propio ———————————————————————————————

const BASE_CATALOGO = 'https://cdn.jsdelivr.net/gh/json-alzate/chesscolate_pngs_packs@main';

/** Cuatro partidas de "Petrosian" (de prueba) con todas las combinaciones de color y resultado. */
export const PAQUETE_PETROSIAN = [
  construirPgn(
    { Event: 'Torneo de prueba 1', Site: '?', Date: '1959.05.01', Round: '1', White: 'Petrosian, Tigran V', Black: 'Spassky, Boris V', WhiteElo: '', BlackElo: '' },
    MATE_DEL_PASTOR,
    '1-0'
  ),
  construirPgn(
    { Event: 'Torneo de prueba 2', Site: '?', Date: '1960.06.02', Round: '2', White: 'Botvinnik, Mikhail', Black: 'Petrosian, Tigran V', WhiteElo: '', BlackElo: '' },
    MATE_DEL_LOCO,
    '0-1'
  ),
  construirPgn(
    { Event: 'Torneo de prueba 3', Site: '?', Date: '1961.07.03', Round: '3', White: 'Petrosian, Tigran V', Black: 'Smyslov, Vasily', WhiteElo: '', BlackElo: '' },
    REPETICION,
    '1/2-1/2'
  ),
  construirPgn(
    { Event: 'Torneo de prueba 4', Site: '?', Date: '1962.08.04', Round: '4', White: 'Fischer, Robert J', Black: 'Petrosian, Tigran V', WhiteElo: '', BlackElo: '' },
    ITALIANA,
    '1-0'
  ),
].join('\n');

/**
 * Sirve el catálogo de partidas (`index.json`) con un único campeón de prueba y su paquete
 * PGN. Sin esto, el guardián de red respondería con el JSON de puzzles a cualquier URL
 * de jsDelivr y el paquete no sería un PGN.
 */
export async function simularCatalogoDePartidas(page: Page): Promise<Peticiones> {
  const peticiones: Peticiones = [];
  await page.route(/^https:\/\/cdn\.jsdelivr\.net\/gh\/json-alzate\/chesscolate_pngs_packs@main\//, (route) => {
    const url = new URL(route.request().url());
    peticiones.push(url.pathname);
    if (url.pathname.endsWith('/index.json')) {
      return json(route, {
        generatedAt: '2026-10-01T00:00:00.000Z',
        collections: [
          {
            id: 'petrosian',
            name: 'Tigran Petrosian',
            reign: '1963–1969',
            games: 4,
            sizeBytes: PAQUETE_PETROSIAN.length,
            file: 'players/petrosian.pgn',
          },
        ],
      });
    }
    if (url.pathname.endsWith('/players/petrosian.pgn')) {
      return route.fulfill({ status: 200, contentType: 'text/plain', headers: CORS, body: PAQUETE_PETROSIAN });
    }
    return route.fulfill({ status: 404, headers: CORS, body: 'not found' });
  });
  return peticiones;
}

// — Lo que queda en el dispositivo ———————————————————————————————

/**
 * Claves de los meses de partidas guardados en IndexedDB (`ChessColateArchiveDB`), p. ej.
 * `chess.com:jalzate_cc:2026-10`. Es el "archivo" local del análisis de partidas.
 */
export async function mesesGuardados(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      new Promise<string[]>((ok) => {
        const abrir = indexedDB.open('ChessColateArchiveDB');
        abrir.onerror = () => ok([]);
        abrir.onsuccess = () => {
          const db = abrir.result;
          if (!db.objectStoreNames.contains('months')) {
            db.close();
            ok([]);
            return;
          }
          const claves = db.transaction('months', 'readonly').objectStore('months').getAllKeys();
          claves.onsuccess = () => {
            db.close();
            ok((claves.result as string[]).sort());
          };
          claves.onerror = () => {
            db.close();
            ok([]);
          };
        };
      })
  );
}

/** Cuántas partidas hay guardadas en total en el archivo local. */
export async function partidasGuardadas(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((ok) => {
        const abrir = indexedDB.open('ChessColateArchiveDB');
        abrir.onerror = () => ok(0);
        abrir.onsuccess = () => {
          const db = abrir.result;
          if (!db.objectStoreNames.contains('months')) {
            db.close();
            ok(0);
            return;
          }
          const todo = db.transaction('months', 'readonly').objectStore('months').getAll();
          todo.onsuccess = () => {
            db.close();
            ok((todo.result as { games: unknown[] }[]).reduce((n, mes) => n + mes.games.length, 0));
          };
          todo.onerror = () => {
            db.close();
            ok(0);
          };
        };
      })
  );
}
