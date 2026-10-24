/**
 * Pixel art dibujado con código: cada dibujo es una lista de filas de texto y una paleta (un carácter por color; el
 * resto, transparente). Así las galletas, el frasco o el rey de las sombras no necesitan archivos de imagen.
 */

export type PixelArt = readonly string[];
export type Palette = Readonly<Record<string, string>>;

/** Pinta `art` con su esquina de arriba a la izquierda en (x, y). Con `flip` lo refleja en horizontal. */
export function drawPixelArt(ctx: CanvasRenderingContext2D, art: PixelArt, palette: Palette, x: number, y: number, flip = false): void {
  art.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      const color = palette[row[dx]];
      if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(x + (flip ? row.length - 1 - dx : dx), y + dy, 1, 1);
      }
    }
  });
}

/** Ancho y alto de un dibujo. */
export function artSize(art: PixelArt): { width: number; height: number } {
  return { width: Math.max(0, ...art.map((row) => row.length)), height: art.length };
}

/** La galleta de ChessColate (9×9): `X` borde, `o` masa, `h` brillo y `c` chispas de chocolate. */
export const COOKIE_ART: PixelArt = [
  '..XXXXX..',
  '.XhhoooX.',
  'XhooocooX',
  'XoocooooX',
  'XoooooocX',
  'XocoooooX',
  'XoooocooX',
  '.XoooooX.',
  '..XXXXX..',
];
export const COOKIE_PALETTE: Palette = { X: '#6b3d17', o: '#d99a52', h: '#f2c987', c: '#3a1f0c' };

/** El frasco de galletas doradas que roba el Rey de las Sombras (14×18): `G` cristal, `L` tapa, `c` galleta, `s` brillo. */
export const JAR_ART: PixelArt = [
  '....LLLLLL....',
  '...LLLLLLLL...',
  '....GGGGGG....',
  '...GsGGGGGG...',
  '..GsGGGGGGGG..',
  '..GGcccGGGGG..',
  '..GGccocGGGG..',
  '..GccooocGGG..',
  '..GGcocooGGG..',
  '..GcooocoGGG..',
  '..GGccoooGGG..',
  '..GccocooGGG..',
  '..GGcooccGGG..',
  '..GccoocoGGG..',
  '..GGGcccGGGG..',
  '..GGGGGGGGGG..',
  '...GGGGGGGG...',
  '....GGGGGG....',
];
export const JAR_PALETTE: Palette = {
  G: 'rgba(190, 230, 255, 0.55)',
  L: '#e0a31c',
  c: '#6b3d17',
  o: '#d99a52',
  s: 'rgba(255, 255, 255, 0.85)',
};

/** Un peldaño de piedra donde descansa el frasco (20×6). */
export const PEDESTAL_ART: PixelArt = [
  '..SSSSSSSSSSSSSSSS..',
  '.SttttttttttttttttS.',
  'SSSSSSSSSSSSSSSSSSSS',
  '..SddddddddddddddS..',
  '..SddddddddddddddS..',
  '.SSSSSSSSSSSSSSSSSS.',
];
export const PEDESTAL_PALETTE: Palette = { S: '#8a8f99', t: '#b9bfc9', d: '#6a6f79' };

/** Un signo de exclamación (5×9): el perrito se da cuenta de algo. */
export const ALERT_ART: PixelArt = [
  '.RRR.',
  '.RRR.',
  '.RRR.',
  '.RRR.',
  '.RRR.',
  '.....',
  '.RRR.',
  '.RRR.',
];
export const ALERT_PALETTE: Palette = { R: '#ff4d4d' };

/** Una estrella de cinco puntas (9×9), para las estrellas de un capítulo. */
export const STAR_ART: PixelArt = [
  '....Y....',
  '....Y....',
  '...YYY...',
  'YYYYYYYYY',
  '.YYYYYYY.',
  '..YYYYY..',
  '..YYYYY..',
  '.YYY.YYY.',
  '.YY...YY.',
];
export const STAR_PALETTE: Palette = { Y: '#ffd24a' };
export const STAR_EMPTY_PALETTE: Palette = { Y: 'rgba(255, 255, 255, 0.22)' };

/** La estrella que hace imparable al perrito (9×9): `X` borde, `Y` cuerpo y `h` brillo. */
export const POWER_STAR_ART: PixelArt = [
  '....X....',
  '...XYX...',
  'XXXXhXXXX',
  'XYYYhYYYX',
  '.XYYYYYX.',
  '..XYYYX..',
  '..XYXYX..',
  '.XYX.XYX.',
  '.XX...XX.',
];
export const POWER_STAR_PALETTE: Palette = { X: '#b86a00', Y: '#ffd24a', h: '#fff3b0' };

// ---------------------------------------------------------------------------------- globos con dibujitos
// La historia se cuenta sin palabras: sobre los personajes salen globos con dibujitos (el frasco, el rey, una flecha…).

export type BubbleIcon = 'jar' | 'king' | 'dog' | 'arrow' | 'question' | 'tear' | 'fire' | 'zzz' | 'heart' | 'cookie' | 'crown' | 'bone';

export interface BubbleArt {
  art: PixelArt;
  palette: Palette;
}

export const BUBBLE_ICONS: Record<BubbleIcon, BubbleArt> = {
  jar: {
    art: ['..LLLLL..', '...GGG...', '..GsGGG..', '.GGccGGG.', '.GcooGGG.', '.GGcocGG.', '.GcoocGG.', '.GGcooGG.', '.GGGGGGG.', '..GGGGG..', '...GGG...'],
    palette: { L: '#e0a31c', G: '#9fd4f5', s: '#ffffff', c: '#6b3d17', o: '#d99a52' },
  },
  king: {
    art: ['....P....', '...PPP...', '....P....', '..PPPPP..', '.PPPPPPP.', '.PPrPrPP.', '.PPPPPPP.', '..PPPPP..', '..PPPPP..', '.PPPPPPP.', 'PPPPPPPPP'],
    palette: { P: '#4a2a7a', r: '#ff4d4d' },
  },
  dog: {
    art: ['BB.......BB', 'BDB.....BDB', 'BDBBBBBBBDB', '.BBBBBBBBB.', '.BBkBBBkBB.', '.BBBBBBBBB.', '..BBBnBBB..', '...BBtBB...', '....BBB....'],
    palette: { B: '#9a6330', D: '#5a3a1a', k: '#1b1b1b', n: '#2a1a10', t: '#ff7a8a' },
  },
  arrow: {
    art: ['.....X...', '......X..', 'XXXXXXXXX', '......X..', '.....X...'],
    palette: { X: '#3a3a3a' },
  },
  question: {
    art: ['.XXX.', 'X...X', '....X', '...X.', '..X..', '..X..', '.....', '..X..', '..X..'],
    palette: { X: '#3a3a3a' },
  },
  tear: {
    art: ['..B..', '..B..', '.BBB.', 'BBwBB', 'BBBBB', 'BBBBB', '.BBB.'],
    palette: { B: '#4aa3ff', w: '#ffffff' },
  },
  fire: {
    art: ['...O...', '..OO...', '..OOO..', '.OOYOO.', '.OYYYO.', 'OOYYYOO', 'OOYYYOO', '.OOYOO.', '..OOO..'],
    palette: { O: '#ff7a1a', Y: '#ffd24a' },
  },
  zzz: {
    art: ['ZZZZ...', '..Z....', '.Z.....', 'ZZZZ...'],
    palette: { Z: '#5d7bd6' },
  },
  heart: {
    art: ['.RR.RR.', 'RRRRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...'],
    palette: { R: '#e8343f' },
  },
  cookie: { art: COOKIE_ART, palette: COOKIE_PALETTE },
  crown: {
    art: ['Y.Y.Y.Y', 'YYYYYYY', 'YrYgYrY', 'YYYYYYY'],
    palette: { Y: '#ffd24a', r: '#e0402f', g: '#3fc27a' },
  },
  bone: {
    art: ['WW...WW', 'WWWWWWW', 'WW...WW'],
    palette: { W: '#f4ecd8' },
  },
};
