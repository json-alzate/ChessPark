/**
 * Los iconos de los poderes del perrito, en pixel art: salen en las escenas de la historia y en el mapa. Cada uno es
 * una cosita reconocible (una corona, un escudo, un corazón…) y no lleva texto: se entiende mirándolo.
 */

import { RunnerPowerId } from '../campaign/runner-curriculum';
import { Palette, PixelArt } from './pixel-art';

export interface PowerIcon {
  art: PixelArt;
  palette: Palette;
}

export const POWER_ICONS: Record<RunnerPowerId, PowerIcon> = {
  // Un hocico que brilla: olfato para las galletas
  nose: {
    art: ['...Y...', '..YWY..', '.YWWWY.', 'YWWWWWY', '.YWWWY.', '..YWY..', '...Y...'],
    palette: { Y: '#ffd24a', W: '#fff7c4' },
  },
  // Un muelle
  spring: {
    art: ['.YYYYY.', '...YY..', '.YYYYY.', '...YY..', '.YYYYY.', '...YY..', '.YYYYY.'],
    palette: { Y: '#e9d54a' },
  },
  // Un escudo
  shield: {
    art: ['BBBBBBB', 'BLLLLLB', 'BLLBLLB', 'BLLBLLB', '.BLLLB.', '..BLB..', '...B...'],
    palette: { B: '#2f6fd0', L: '#8fc0ff' },
  },
  // Una bufanda al viento
  trail: {
    art: ['.RRRRR.', 'RRRRRRR', 'RR...RR', '.....RR', '....RR.', '...RR..', '..RR...'],
    palette: { R: '#e0402f' },
  },
  // Un ojo
  ghost: {
    art: ['.CCCCC.', 'CCWWWCC', 'CWWKKWC', 'CWWKKWC', 'CCWWWCC', '.CCCCC.'],
    palette: { C: '#7ff3ff', W: '#ffffff', K: '#1b2450' },
  },
  // Un corazón
  heart: {
    art: ['.RR.RR.', 'RRRRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...'],
    palette: { R: '#e8343f' },
  },
  // Una red
  net: {
    art: ['G.G.G.G', '.GGGGG.', 'G.G.G.G', '.GGGGG.', 'G.G.G.G', '.GGGGG.'],
    palette: { G: '#9be0a5' },
  },
  // Una venda verde
  dodge: {
    art: ['GGGGGGG', 'GGGGGGG', '.....GG', '....GG.', '...GG..'],
    palette: { G: '#3fc27a' },
  },
  // Una capa
  cloak: {
    art: ['.PPPPP.', 'PPPPPPP', 'PPPPPPP', 'PPPPPPP', 'PP...PP', 'P.....P'],
    palette: { P: '#7d4fd0' },
  },
  // Una corona
  crown: {
    art: ['Y.Y.Y.Y', 'YYYYYYY', 'YrYgYrY', 'YYYYYYY'],
    palette: { Y: '#ffd24a', r: '#e0402f', g: '#3fc27a' },
  },
};

/** Tamaño del icono, en píxeles lógicos. */
export function iconSize(id: RunnerPowerId): { width: number; height: number } {
  const { art } = POWER_ICONS[id];
  return { width: Math.max(...art.map((row) => row.length)), height: art.length };
}

const urlCache = new Map<string, string>();

/**
 * El icono como imagen (`data:`) para las plantillas, ampliado `scale` veces sin suavizar. Si el navegador no
 * puede dibujarlo (una prueba sin canvas), devuelve una cadena vacía y la plantilla no enseña nada.
 */
export function powerIconUrl(id: RunnerPowerId, scale = 4): string {
  const key = `${id}@${scale}`;
  const cached = urlCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  let url = '';
  try {
    const { art, palette } = POWER_ICONS[id];
    const { width, height } = iconSize(id);
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      art.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          const color = palette[row[x]];
          if (color) {
            ctx.fillStyle = color;
            ctx.fillRect(x * scale, y * scale, scale, scale);
          }
        }
      });
      url = canvas.toDataURL('image/png');
    }
  } catch {
    url = '';
  }
  urlCache.set(key, url);
  return url;
}
