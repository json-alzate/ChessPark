import { encodeQr, encodeQrWithMask, QR_MAX_BYTES, QrMatrix } from '@features/stream/utils/qr-code.util';

const URL = 'https://chesscolate.web.app/?utm_source=youtube';

/**
 * Vector de oro: el mismo texto con la máscara 2, generado por una librería de QR
 * independiente (qrcode-generator 1.4.4). Comprobamos nuestro codificador contra él módulo
 * a módulo. Aparte, se verificó con un decodificador real (jsQR) que los códigos de este
 * codificador se leen: 169 de 169 textos de 1 a 106 bytes.
 */
const REFERENCIA_MASCARA_2 = [
    '#######.......#.#.####.#..#######',
    '#.....#....#...##.#.###...#.....#',
    '#.###.#.##.#..#.#..######.#.###.#',
    '#.###.#.###.......#...#...#.###.#',
    '#.###.#.##....###...##.#..#.###.#',
    '#.....#.###.#.#....#....#.#.....#',
    '#######.#.#.#.#.#.#.#.#.#.#######',
    '........###.#.#.#..####..........',
    '#.#####..#...##.##.##.#...#####..',
    '#####....#.#.##..#####.#..##.####',
    '...#.###..#..#####.......#..#.##.',
    '###.....##.###..######.###..#####',
    '.#....#.##..#.#.#..##.#....###.##',
    '..#..#..#..##..#..#....#.##...###',
    '##..###..#.#...####.#.#..##.##.#.',
    '#.##.#.##.#..#.#..#..##..###.##..',
    '##.####..#...#.#.##...#..#.##...#',
    '###.#..#.#.##.....##.#.#..##.###.',
    '#..##.#.###...##..#.###..####.##.',
    '#..###.#.##.#.##....###..#.#####.',
    '#....##.#..#.#.#..#..#...#.###.##',
    '####.......#..####..#..#.##..#..#',
    '#.#...###..#..#..#.#.##....###.#.',
    '#...#..##.##.#..#.####.#.###.####',
    '#..##.#.###.##..##.#..########.##',
    '........#.#.#...#####...#...#.#.#',
    '#######...######.#....###.#.#.##.',
    '#.....#.##....##.##.#..##...###..',
    '#.###.#.######.##...###.######.#.',
    '#.###.#.####.#.#..#..#..##..###.#',
    '#.###.#.#####.###.#.##....##.##..',
    '#.....#..###..##.....##...#.###..',
    '#######.#...#..###..#.####.#.#.#.',
];

const toRows = (matrix: QrMatrix): string[] => matrix.map((row) => row.map((dark) => (dark ? '#' : '.')).join(''));

describe('encodeQr', () => {
  it('coincide módulo a módulo con la librería de referencia', () => {
    expect(toRows(encodeQrWithMask(URL, 2))).toEqual(REFERENCIA_MASCARA_2);
  });

  it('la máscara que elige es una de las ocho válidas', () => {
    const chosen = toRows(encodeQr(URL));
    const candidates = Array.from({ length: 8 }, (_, mask) => toRows(encodeQrWithMask(URL, mask)));

    expect(candidates).toContainEqual(chosen);
  });

  it('es determinista', () => {
    expect(encodeQr(URL)).toEqual(encodeQr(URL));
  });

  it('la URL del directo cabe en la versión 4 (33×33 módulos)', () => {
    expect(encodeQr(URL)).toHaveLength(33);
  });

  it('elige la versión más pequeña que cabe', () => {
    expect(encodeQr('a'.repeat(14))).toHaveLength(21); // versión 1
    expect(encodeQr('a'.repeat(15))).toHaveLength(25); // versión 2
    expect(encodeQr('a'.repeat(26))).toHaveLength(25);
    expect(encodeQr('a'.repeat(27))).toHaveLength(29); // versión 3
    expect(encodeQr('a'.repeat(QR_MAX_BYTES))).toHaveLength(41); // versión 6
  });

  it('lanza si el texto no cabe', () => {
    expect(() => encodeQr('a'.repeat(QR_MAX_BYTES + 1))).toThrow(/demasiado largo/);
  });

  it('cuenta bytes, no letras: un carácter con acento ocupa más', () => {
    expect(() => encodeQr('é'.repeat(54))).toThrow();
    expect(() => encodeQr('é'.repeat(53))).not.toThrow();
  });

  describe('estructura', () => {
    const matrix = encodeQr(URL);
    const size = matrix.length;

    const finder = (top: number, left: number): string[] =>
      Array.from({ length: 7 }, (_, r) => matrix[top + r].slice(left, left + 7).map((d) => (d ? '#' : '.')).join(''));
    const FINDER = ['#######', '#.....#', '#.###.#', '#.###.#', '#.###.#', '#.....#', '#######'];

    it('lleva los tres localizadores en las esquinas', () => {
      expect(finder(0, 0)).toEqual(FINDER);
      expect(finder(0, size - 7)).toEqual(FINDER);
      expect(finder(size - 7, 0)).toEqual(FINDER);
    });

    it('lleva las líneas de sincronía alternadas', () => {
      for (let i = 8; i < size - 8; i++) {
        expect(matrix[6][i]).toBe(i % 2 === 0);
        expect(matrix[i][6]).toBe(i % 2 === 0);
      }
    });

    it('lleva el módulo oscuro fijo', () => {
      expect(matrix[size - 8][8]).toBe(true);
    });

    it('es cuadrada', () => {
      expect(matrix.every((row) => row.length === size)).toBe(true);
    });
  });
});
