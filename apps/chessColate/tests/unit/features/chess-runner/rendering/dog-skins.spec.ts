import { DEFAULT_SKIN, DOG_SKINS, isSkinId, recolor, skinById, skinPreviewUrl, withSkin } from '@features/chess-runner/rendering/dog-skins';
import { RunnerSprite } from '@features/chess-runner/services/runner-sprites.service';

/** Los colores del pelo del perrito original (los de las hojas de sprites). */
const PELO = [0x6e4331, 0x4d2e21, 0x52301f, 0x3a2218, 0x8c5a43, 0x2a1710, 0xcdbfb2, 0xe3d9cf];
const COLLAR = 0x7fd35a;

/** Un lienzo falso con una hoja de dos píxeles de pelo y uno de collar, y un píxel transparente. */
function lienzoFalso(pixeles: number[][]) {
  const datos = new Uint8ClampedArray(pixeles.flat());
  const ctx = {
    drawImage: jest.fn(),
    getImageData: jest.fn(() => ({ data: datos })),
    putImageData: jest.fn(),
    imageSmoothingEnabled: true,
  };
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,FALSA');
  return { ctx, datos };
}

const rgb = (hex: number, alfa = 255) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255, alfa];
const hojaDe = (nombre = 'dog-run'): [string, RunnerSprite] => [nombre, { image: { nombre } as unknown as CanvasImageSource, frameW: 52, frameH: 40, frames: 2, fps: 8 }];

describe('los pelajes del perrito', () => {
  afterEach(() => jest.restoreAllMocks());

  it('el original es gratis y los demás cuestan cada vez más galletas, sin repetirse', () => {
    expect(DOG_SKINS[0]).toMatchObject({ id: DEFAULT_SKIN, price: 0 });
    expect(new Set(DOG_SKINS.map((s) => s.id)).size).toBe(DOG_SKINS.length);
    const precios = DOG_SKINS.map((s) => s.price);
    expect(precios).toEqual([...precios].sort((a, b) => a - b));
    expect(DOG_SKINS.length).toBeGreaterThanOrEqual(5);
  });

  it('cada pelaje cambia los ocho colores del pelo y ninguno más (el collar, la lengua y la chapa se quedan)', () => {
    for (const pelaje of DOG_SKINS.slice(1)) {
      expect(Object.keys(pelaje.colors).sort()).toEqual(PELO.map((c) => c.toString(16).padStart(6, '0')).sort());
      expect(Object.keys(pelaje.colors)).not.toContain(COLLAR.toString(16));
      Object.values(pelaje.colors).forEach((c) => expect(c).toMatch(/^[0-9a-f]{6}$/));
      expect(pelaje.swatch).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('skinById e isSkinId: lo desconocido cae en el original', () => {
    expect(skinById('golden').id).toBe('golden');
    expect(skinById('volador').id).toBe(DEFAULT_SKIN);
    expect(isSkinId('snow')).toBe(true);
    expect(isSkinId('volador')).toBe(false);
    expect(isSkinId(7)).toBe(false);
  });

  it('recolor cambia el pelo, deja lo demás y lo transparente como estaba', () => {
    const { datos, ctx } = lienzoFalso([rgb(0x6e4331), rgb(COLLAR), rgb(0x6e4331, 0)]);
    const imagen = {} as unknown as CanvasImageSource;

    const copia = recolor(imagen, 3, 1, 'golden');

    expect(copia).not.toBe(imagen);
    expect(ctx.putImageData).toHaveBeenCalledTimes(1);
    expect([datos[0], datos[1], datos[2]]).toEqual([0xd9, 0xa4, 0x41]);
    expect([datos[4], datos[5], datos[6]]).toEqual([0x7f, 0xd3, 0x5a]);
    // El píxel transparente no se tocó
    expect([datos[8], datos[9], datos[10], datos[11]]).toEqual([0x6e, 0x43, 0x31, 0]);
  });

  it('recolor con el pelaje original devuelve la misma imagen sin dibujar nada', () => {
    const { ctx } = lienzoFalso([rgb(0x6e4331)]);
    const imagen = {} as unknown as CanvasImageSource;

    expect(recolor(imagen, 1, 1, DEFAULT_SKIN)).toBe(imagen);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('la copia se guarda: pedir lo mismo dos veces no rehace el trabajo', () => {
    const { ctx } = lienzoFalso([rgb(0x6e4331)]);
    const imagen = {} as unknown as CanvasImageSource;

    const a = recolor(imagen, 1, 1, 'night');
    const b = recolor(imagen, 1, 1, 'night');

    expect(a).toBe(b);
    expect(ctx.putImageData).toHaveBeenCalledTimes(1);
    expect(recolor(imagen, 1, 1, 'sky')).not.toBe(a);
  });

  it('sin canvas (o si falla) devuelve la imagen tal cual', () => {
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const imagen = {} as unknown as CanvasImageSource;
    expect(recolor(imagen, 1, 1, 'berry')).toBe(imagen);

    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
      throw new Error('sin permiso');
    });
    const otra = {} as unknown as CanvasImageSource;
    expect(recolor(otra, 1, 1, 'berry')).toBe(otra);
  });

  it('withSkin solo cambia las hojas del perrito y respeta las demás', () => {
    lienzoFalso([rgb(0x6e4331)]);
    const sprites = new Map<string, RunnerSprite>([hojaDe('dog-run'), hojaDe('dog-jump'), hojaDe('fx-dust'), hojaDe('scene-sky')]);

    const conPelaje = withSkin(sprites, 'golden');

    expect(conPelaje.get('dog-run')!.image).not.toBe(sprites.get('dog-run')!.image);
    expect(conPelaje.get('dog-jump')!.image).not.toBe(sprites.get('dog-jump')!.image);
    expect(conPelaje.get('fx-dust')!.image).toBe(sprites.get('fx-dust')!.image);
    expect(conPelaje.get('scene-sky')!.image).toBe(sprites.get('scene-sky')!.image);
    // Lo demás de la hoja (tamaños, fotogramas) igual
    expect(conPelaje.get('dog-run')).toMatchObject({ frameW: 52, frameH: 40, frames: 2, fps: 8 });
    // El original no se toca y el pelaje por defecto devuelve una copia del mapa con lo mismo
    expect(withSkin(sprites, DEFAULT_SKIN).get('dog-run')!.image).toBe(sprites.get('dog-run')!.image);
    expect(withSkin(sprites, DEFAULT_SKIN)).not.toBe(sprites);
  });

  it('la vista previa es una imagen del perrito contento, o nada si no hay con qué dibujar', () => {
    const { ctx } = lienzoFalso([rgb(0x6e4331)]);
    const sprites = new Map<string, RunnerSprite>([hojaDe('dog-happy')]);

    expect(skinPreviewUrl(sprites, 'snow')).toBe('data:image/png;base64,FALSA');
    expect(ctx.imageSmoothingEnabled).toBe(false);
    expect(skinPreviewUrl(new Map(), 'snow')).toBe('');

    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(skinPreviewUrl(sprites, 'night')).toBe('');
  });
});
