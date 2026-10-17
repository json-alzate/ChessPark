import {
  ALERT_ART,
  ALERT_PALETTE,
  artSize,
  COOKIE_ART,
  COOKIE_PALETTE,
  drawPixelArt,
  JAR_ART,
  JAR_PALETTE,
  PEDESTAL_ART,
  PEDESTAL_PALETTE,
  PixelArt,
  Palette,
  STAR_ART,
  STAR_EMPTY_PALETTE,
  STAR_PALETTE,
} from '@features/chess-runner/rendering/pixel-art';

function contexto() {
  const pintado: { x: number; y: number; color: string }[] = [];
  const ctx = { fillStyle: '' } as unknown as CanvasRenderingContext2D & { fillRect: jest.Mock };
  ctx.fillRect = jest.fn((x: number, y: number) => {
    pintado.push({ x, y, color: ctx.fillStyle as string });
  });
  return { ctx, pintado };
}

describe('drawPixelArt', () => {
  const arte: PixelArt = ['AB.', '.BA'];
  const paleta: Palette = { A: '#a', B: '#b' };

  it('pinta un cuadrado por carácter con color, a partir de la esquina dada', () => {
    const { ctx, pintado } = contexto();

    drawPixelArt(ctx, arte, paleta, 10, 20);

    expect(pintado).toEqual([
      { x: 10, y: 20, color: '#a' },
      { x: 11, y: 20, color: '#b' },
      { x: 11, y: 21, color: '#b' },
      { x: 12, y: 21, color: '#a' },
    ]);
  });

  it('lo que no está en la paleta queda transparente: no se pinta', () => {
    const { ctx, pintado } = contexto();

    drawPixelArt(ctx, ['..', '..'], paleta, 0, 0);

    expect(pintado).toEqual([]);
  });

  it('con flip lo refleja en horizontal', () => {
    const { ctx, pintado } = contexto();

    drawPixelArt(ctx, arte, paleta, 0, 0, true);

    expect(pintado.map((p) => [p.x, p.y, p.color])).toEqual([
      [2, 0, '#a'],
      [1, 0, '#b'],
      [1, 1, '#b'],
      [0, 1, '#a'],
    ]);
  });

  it('artSize mide el dibujo', () => {
    expect(artSize(arte)).toEqual({ width: 3, height: 2 });
    expect(artSize([])).toEqual({ width: 0, height: 0 });
  });
});

describe('los dibujos del juego', () => {
  const dibujos: [string, PixelArt, Palette, number, number][] = [
    ['galleta', COOKIE_ART, COOKIE_PALETTE, 9, 9],
    ['frasco', JAR_ART, JAR_PALETTE, 14, 18],
    ['peldaño', PEDESTAL_ART, PEDESTAL_PALETTE, 20, 6],
    ['alerta', ALERT_ART, ALERT_PALETTE, 5, 8],
    ['estrella', STAR_ART, STAR_PALETTE, 9, 9],
  ];

  it.each(dibujos)('el %s tiene todas las filas del mismo ancho y su medida', (_nombre, arte, _paleta, ancho, alto) => {
    expect(artSize(arte)).toEqual({ width: ancho, height: alto });
    expect(arte.every((fila) => fila.length === ancho)).toBe(true);
  });

  it.each(dibujos)('el %s no usa ningún color que falte en su paleta', (_nombre, arte, paleta) => {
    const usados = new Set(arte.join('').replace(/\./g, ''));
    for (const caracter of usados) {
      expect(paleta[caracter]).toBeDefined();
    }
  });

  it('la galleta es simétrica en lo gordo: su borde cierra por los cuatro lados', () => {
    expect(COOKIE_ART[0]).toMatch(/^\.\.X+\.\.$/);
    expect(COOKIE_ART[COOKIE_ART.length - 1]).toMatch(/^\.\.X+\.\.$/);
  });

  it('la estrella vacía usa la misma forma, más tenue', () => {
    expect(STAR_EMPTY_PALETTE['Y']).toContain('rgba');
    expect(STAR_PALETTE['Y']).not.toEqual(STAR_EMPTY_PALETTE['Y']);
  });
});
