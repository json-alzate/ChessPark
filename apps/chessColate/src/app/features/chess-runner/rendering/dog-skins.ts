/**
 * Los pelajes del perrito: se desbloquean con las galletas que se juntan corriendo. No hay imágenes nuevas: cada pelaje es una
 * tabla de colores que se aplica, pixel a pixel, a las hojas de sprites del perrito (que son pixel art de colores planos, sin
 * suavizado, así que cambiar un color exacto por otro no deja bordes feos). Lo que no es pelo (el collar, la lengua, la
 * chapa) no se toca.
 */

import { RunnerSprite } from '../services/runner-sprites.service';

export interface DogSkin {
  id: string;
  /** Galletas que cuesta desbloquearlo. */
  price: number;
  /** Cada color del pelo del perrito original y por cuál se cambia (en hexadecimal sin `#`). Sin tabla, el original. */
  colors: Readonly<Record<string, string>>;
  /** Un color que lo represente (para el fondo de su tarjeta). */
  swatch: string;
}

/** Los colores del pelo del perrito original: el principal, tres sombras, el brillo, el contorno y los dos del hocico y la barriga. */
const FUR = { main: '6e4331', dark: '4d2e21', mid: '52301f', darker: '3a2218', light: '8c5a43', outline: '2a1710', muzzle: 'cdbfb2', belly: 'e3d9cf' } as const;

const skin = (id: string, price: number, swatch: string, to: Record<keyof typeof FUR, string>): DogSkin => ({
  id,
  price,
  swatch,
  colors: Object.fromEntries((Object.keys(FUR) as (keyof typeof FUR)[]).map((part) => [FUR[part], to[part]])),
});

export const DOG_SKINS: readonly DogSkin[] = [
  { id: 'choco', price: 0, colors: {}, swatch: '#8c5a43' },
  skin('golden', 300, '#d9a441', { main: 'd9a441', dark: 'a8741f', mid: 'b9852c', darker: '8a5d17', light: 'f2cf7a', outline: '4a2f0b', muzzle: 'fff1c9', belly: 'fff8e4' }),
  skin('snow', 700, '#e8e8f0', { main: 'e8e8f0', dark: 'b4b6c8', mid: 'c9cad8', darker: '9a9cb0', light: 'ffffff', outline: '3c4056', muzzle: 'ffffff', belly: 'f6f6fa' }),
  skin('night', 1200, '#3b3b4f', { main: '3b3b4f', dark: '26263a', mid: '2f2f44', darker: '1c1c2c', light: '5a5a78', outline: '0e0e18', muzzle: '8a8aa8', belly: 'a5a5c0' }),
  skin('berry', 2000, '#c8517a', { main: 'c8517a', dark: '8e2f55', mid: 'a53e66', darker: '6e1f40', light: 'e58aa8', outline: '3a0f22', muzzle: 'ffd0e0', belly: 'ffe6ee' }),
  skin('sky', 3200, '#4a8fd6', { main: '4a8fd6', dark: '2f5f9e', mid: '3b74b8', darker: '234a80', light: '8dc0f0', outline: '10284a', muzzle: 'd6ebff', belly: 'eaf5ff' }),
];

export const DEFAULT_SKIN = 'choco';

export function skinById(id: string): DogSkin {
  return DOG_SKINS.find((candidate) => candidate.id === id) ?? DOG_SKINS[0];
}

export function isSkinId(id: unknown): id is string {
  return typeof id === 'string' && DOG_SKINS.some((candidate) => candidate.id === id);
}

const hexToRgb = (hex: string): [number, number, number] => [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];

/** Las copias ya hechas: la imagen original y el pelaje dan siempre la misma. */
const cache = new WeakMap<object, Map<string, CanvasImageSource>>();

/**
 * La imagen de una hoja de sprites con el pelaje cambiado. Si el pelaje es el original, o el navegador no puede dibujar o leer
 * la imagen (una prueba sin canvas), devuelve la misma imagen.
 */
export function recolor(image: CanvasImageSource, width: number, height: number, skinId: string): CanvasImageSource {
  const chosen = skinById(skinId);
  if (Object.keys(chosen.colors).length === 0) {
    return image;
  }
  const bySkin = cache.get(image as object) ?? new Map<string, CanvasImageSource>();
  cache.set(image as object, bySkin);
  const cached = bySkin.get(chosen.id);
  if (cached) {
    return cached;
  }
  let result: CanvasImageSource = image;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(image, 0, 0);
      const data = ctx.getImageData(0, 0, width, height);
      const table = new Map(Object.entries(chosen.colors).map(([from, to]) => [(hexToRgb(from)[0] << 16) | (hexToRgb(from)[1] << 8) | hexToRgb(from)[2], hexToRgb(to)]));
      const pixels = data.data;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] === 0) {
          continue;
        }
        const replacement = table.get((pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2]);
        if (replacement) {
          pixels[i] = replacement[0];
          pixels[i + 1] = replacement[1];
          pixels[i + 2] = replacement[2];
        }
      }
      ctx.putImageData(data, 0, 0);
      result = canvas;
    }
  } catch {
    result = image;
  }
  bySkin.set(chosen.id, result);
  return result;
}

/** Las hojas de sprites con el pelaje elegido en las del perrito (las demás, tal cual). */
export function withSkin(sprites: ReadonlyMap<string, RunnerSprite>, skinId: string): Map<string, RunnerSprite> {
  if (skinById(skinId).id === DEFAULT_SKIN) {
    return new Map(sprites);
  }
  return new Map(
    [...sprites].map(([name, sprite]) => [
      name,
      name.startsWith('dog-') ? { ...sprite, image: recolor(sprite.image, sprite.frameW * sprite.frames, sprite.frameH, skinId) } : sprite,
    ])
  );
}

/** Una imagen (`data:`) del perrito contento con ese pelaje, para las tarjetas del armario. Vacía si no se puede dibujar. */
export function skinPreviewUrl(sprites: ReadonlyMap<string, RunnerSprite>, skinId: string, scale = 3): string {
  const sprite = sprites.get('dog-happy');
  if (!sprite) {
    return '';
  }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = sprite.frameW * scale;
    canvas.height = sprite.frameH * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return '';
    }
    ctx.imageSmoothingEnabled = false;
    const image = recolor(sprite.image, sprite.frameW * sprite.frames, sprite.frameH, skinId);
    ctx.drawImage(image, 0, 0, sprite.frameW, sprite.frameH, 0, 0, sprite.frameW * scale, sprite.frameH * scale);
    return canvas.toDataURL('image/png');
  } catch {
    return '';
  }
}
