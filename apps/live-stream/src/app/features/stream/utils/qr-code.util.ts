/**
 * Codificador de códigos QR (ISO/IEC 18004), mínimo y sin dependencias.
 *
 * Solo hace lo que necesita el directo: texto en modo bytes (UTF-8), corrección de errores
 * de nivel M y versiones 1 a 6 (hasta 106 bytes). Para una URL sobra. Se escribió aquí
 * para no añadir una dependencia por una sola pantalla; la corrección se comprobó
 * decodificando miles de códigos con un lector independiente y comparando contra una
 * librería de referencia (ver el spec).
 */

/** Matriz del código: `true` es un módulo oscuro. */
export type QrMatrix = boolean[][];

interface VersionInfo {
  /** Palabras de datos en total. */
  dataWords: number;
  /** Palabras de corrección por bloque. */
  ecWords: number;
  /** Número de bloques (todos del mismo tamaño en estas versiones, nivel M). */
  blocks: number;
  /** Centros de los patrones de alineación (filas y columnas). */
  alignment: number[];
}

// Nivel M, versiones 1..6.
const VERSIONS: readonly VersionInfo[] = [
  { dataWords: 16, ecWords: 10, blocks: 1, alignment: [] },
  { dataWords: 28, ecWords: 16, blocks: 1, alignment: [6, 18] },
  { dataWords: 44, ecWords: 26, blocks: 1, alignment: [6, 22] },
  { dataWords: 64, ecWords: 18, blocks: 2, alignment: [6, 26] },
  { dataWords: 86, ecWords: 24, blocks: 2, alignment: [6, 30] },
  { dataWords: 108, ecWords: 16, blocks: 4, alignment: [6, 34] },
];

/** Bytes que caben en la versión más grande que se admite. */
export const QR_MAX_BYTES = 106;

// — Aritmética de Galois GF(256), polinomio primitivo x^8 + x^4 + x^3 + x^2 + 1 ————————

const EXP = new Array<number>(512);
const LOG = new Array<number>(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) {
      x ^= 0x11d;
    }
  }
  for (let i = 255; i < 512; i++) {
    EXP[i] = EXP[i - 255];
  }
})();

const gfMul = (a: number, b: number): number => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** Resto de dividir los datos entre el polinomio generador: son las palabras de corrección. */
function reedSolomon(data: readonly number[], ecWords: number): number[] {
  let generator = [1];
  for (let i = 0; i < ecWords; i++) {
    const next = new Array<number>(generator.length + 1).fill(0);
    generator.forEach((coef, j) => {
      next[j] ^= coef;
      next[j + 1] ^= gfMul(coef, EXP[i]);
    });
    generator = next;
  }

  const remainder = new Array<number>(ecWords).fill(0);
  for (const byte of data) {
    const factor = byte ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    for (let i = 0; i < ecWords; i++) {
      remainder[i] ^= gfMul(generator[i + 1], factor);
    }
  }
  return remainder;
}

// — Construcción de la secuencia de palabras ————————————————————————————————

function pickVersion(byteLength: number): number {
  for (let v = 0; v < VERSIONS.length; v++) {
    // 4 bits de modo + 8 de longitud + los datos
    if (12 + byteLength * 8 <= VERSIONS[v].dataWords * 8) {
      return v + 1;
    }
  }
  throw new Error(`El texto es demasiado largo para el QR (${byteLength} bytes, máximo ${QR_MAX_BYTES})`);
}

function buildCodewords(bytes: Uint8Array, info: VersionInfo): number[] {
  const bits: number[] = [];
  const push = (value: number, length: number): void => {
    for (let i = length - 1; i >= 0; i--) {
      bits.push((value >> i) & 1);
    }
  };

  push(0b0100, 4);
  push(bytes.length, 8);
  bytes.forEach((byte) => push(byte, 8));

  const capacity = info.dataWords * 8;
  push(0, Math.min(4, capacity - bits.length));
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  }
  for (let pad = 0; data.length < info.dataWords; pad++) {
    data.push(pad % 2 === 0 ? 0xec : 0x11);
  }

  // Se parten en bloques, se calcula la corrección de cada uno y se intercalan.
  const size = info.dataWords / info.blocks;
  const blocks = Array.from({ length: info.blocks }, (_, i) => data.slice(i * size, (i + 1) * size));
  const ec = blocks.map((block) => reedSolomon(block, info.ecWords));

  const out: number[] = [];
  for (let i = 0; i < size; i++) {
    blocks.forEach((block) => out.push(block[i]));
  }
  for (let i = 0; i < info.ecWords; i++) {
    ec.forEach((block) => out.push(block[i]));
  }
  return out;
}

// — Matriz ———————————————————————————————————————————————————————————————————

const MASKS: readonly ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

interface Grid {
  size: number;
  dark: boolean[][];
  /** Módulos que no son datos (patrones fijos y zonas de formato). */
  fixed: boolean[][];
}

function emptyGrid(version: number): Grid {
  const size = 17 + 4 * version;
  const make = (): boolean[][] => Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  return { size, dark: make(), fixed: make() };
}

function setFixed(grid: Grid, r: number, c: number, dark: boolean): void {
  if (r >= 0 && c >= 0 && r < grid.size && c < grid.size) {
    grid.dark[r][c] = dark;
    grid.fixed[r][c] = true;
  }
}

function drawFinder(grid: Grid, top: number, left: number): void {
  for (let dr = -1; dr <= 7; dr++) {
    for (let dc = -1; dc <= 7; dc++) {
      const inside = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
      const ring = dr === 0 || dr === 6 || dc === 0 || dc === 6;
      const core = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
      setFixed(grid, top + dr, left + dc, inside && (ring || core));
    }
  }
}

function drawAlignment(grid: Grid, centerR: number, centerC: number): void {
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
      setFixed(grid, centerR + dr, centerC + dc, dark);
    }
  }
}

function drawFunctionPatterns(grid: Grid, info: VersionInfo): void {
  const { size } = grid;
  drawFinder(grid, 0, 0);
  drawFinder(grid, 0, size - 7);
  drawFinder(grid, size - 7, 0);

  for (let i = 8; i < size - 8; i++) {
    setFixed(grid, 6, i, i % 2 === 0);
    setFixed(grid, i, 6, i % 2 === 0);
  }

  for (const r of info.alignment) {
    for (const c of info.alignment) {
      const onFinder = (r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6);
      if (!onFinder) {
        drawAlignment(grid, r, c);
      }
    }
  }
}

/** Información de formato (nivel M + máscara), con corrección BCH(15,5). */
function formatBits(mask: number): number {
  const data = (0b00 << 3) | mask;
  let remainder = data << 10;
  for (let i = 14; i >= 10; i--) {
    if ((remainder >> i) & 1) {
      remainder ^= 0x537 << (i - 10);
    }
  }
  return ((data << 10) | remainder) ^ 0x5412;
}

function drawFormat(grid: Grid, mask: number): void {
  const bits = formatBits(mask);
  const { size } = grid;
  for (let i = 0; i < 15; i++) {
    const dark = ((bits >> i) & 1) === 1;
    // Junto a los patrones de la esquina superior izquierda y a los otros dos.
    if (i < 6) {
      setFixed(grid, i, 8, dark);
    } else if (i < 8) {
      setFixed(grid, i + 1, 8, dark);
    } else {
      setFixed(grid, size - 15 + i, 8, dark);
    }

    if (i < 8) {
      setFixed(grid, 8, size - i - 1, dark);
    } else if (i < 9) {
      setFixed(grid, 8, 15 - i - 1 + 1, dark);
    } else {
      setFixed(grid, 8, 15 - i - 1, dark);
    }
  }
  setFixed(grid, size - 8, 8, true); // módulo oscuro fijo
}

function placeData(grid: Grid, codewords: readonly number[], mask: number): void {
  const { size } = grid;
  const bits: number[] = [];
  codewords.forEach((word) => {
    for (let i = 7; i >= 0; i--) {
      bits.push((word >> i) & 1);
    }
  });

  let index = 0;
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) {
      col--; // la columna del patrón de sincronía no lleva datos
    }
    for (let step = 0; step < size; step++) {
      const r = upward ? size - 1 - step : step;
      for (const c of [col, col - 1]) {
        if (grid.fixed[r][c]) {
          continue;
        }
        const bit = index < bits.length ? bits[index] === 1 : false;
        index++;
        grid.dark[r][c] = MASKS[mask](r, c) ? !bit : bit;
      }
    }
    upward = !upward;
  }
}

/** Puntuación de penalización de la norma: gana la máscara con menos puntos. */
function penalty(dark: readonly (readonly boolean[])[]): number {
  const size = dark.length;
  let score = 0;

  const lines: boolean[][] = [];
  for (let i = 0; i < size; i++) {
    lines.push([...dark[i]]);
    lines.push(dark.map((row) => row[i]));
  }

  const finderLike = [true, false, true, true, true, false, true];
  for (const line of lines) {
    // N1: tiras de 5 o más módulos iguales
    let run = 1;
    for (let i = 1; i <= size; i++) {
      if (i < size && line[i] === line[i - 1]) {
        run++;
      } else {
        if (run >= 5) {
          score += 3 + (run - 5);
        }
        run = 1;
      }
    }
    // N3: patrón parecido a un localizador, con cuatro módulos claros a un lado
    for (let i = 0; i + 7 <= size; i++) {
      if (!finderLike.every((value, k) => line[i + k] === value)) {
        continue;
      }
      const lightBefore = i >= 4 && [1, 2, 3, 4].every((k) => !line[i - k]);
      const lightAfter = i + 11 <= size && [7, 8, 9, 10].every((k) => !line[i + k]);
      score += 40 * ((lightBefore ? 1 : 0) + (lightAfter ? 1 : 0));
    }
  }

  // N2: bloques de 2×2 del mismo color
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = dark[r][c];
      if (v === dark[r][c + 1] && v === dark[r + 1][c] && v === dark[r + 1][c + 1]) {
        score += 3;
      }
    }
  }

  // N4: proporción de módulos oscuros alejada del 50 %
  const total = size * size;
  const darkCount = dark.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
  score += Math.floor(Math.abs((darkCount * 100) / total - 50) / 5) * 10;

  return score;
}

function build(text: string, forcedMask?: number): QrMatrix {
  const bytes = new TextEncoder().encode(text);
  const version = pickVersion(bytes.length);
  const info = VERSIONS[version - 1];
  const codewords = buildCodewords(bytes, info);

  const draw = (mask: number): Grid => {
    const grid = emptyGrid(version);
    drawFunctionPatterns(grid, info);
    drawFormat(grid, mask);
    placeData(grid, codewords, mask);
    return grid;
  };

  if (forcedMask !== undefined) {
    return draw(forcedMask).dark;
  }

  let best = draw(0);
  let bestScore = penalty(best.dark);
  for (let mask = 1; mask < MASKS.length; mask++) {
    const candidate = draw(mask);
    const score = penalty(candidate.dark);
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best.dark;
}

/** Codifica un texto como QR. Lanza si no cabe (más de {@link QR_MAX_BYTES} bytes). */
export function encodeQr(text: string): QrMatrix {
  return build(text);
}

/** Igual que {@link encodeQr} pero con la máscara indicada (0–7). Solo para pruebas. */
export function encodeQrWithMask(text: string, mask: number): QrMatrix {
  return build(text, mask);
}
