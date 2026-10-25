import { Injectable } from '@angular/core';

import { PackCharacter, PackMap, RunnerBackdropSprite } from '../models/pack.model';
import { opaqueHeight } from '../utils/pack-lab.util';
import { normalizeMap, normalizePack, normalizeRunnerBackdrop } from '../utils/pack-manifest.util';

/** Lo que el Laboratorio de la manada necesita: la manada, el mapa, los fondos del runner y qué manifiesto no se pudo leer. */
export interface PackAssets {
  characters: PackCharacter[];
  map: PackMap;
  backdrop: Record<string, RunnerBackdropSprite>;
  /** Manifiestos que faltan o vienen rotos (`pack`, `map`, `runner`): la pantalla lo muestra en vez de romperse. */
  missing: Array<'pack' | 'map' | 'runner'>;
  /** Cadena para no reutilizar imágenes viejas al recargar (`?v=…`), o vacía. */
  version: string;
}

/**
 * Lee los manifiestos de la manada (`assets/images/pack/pack.json`), del mapa (`assets/images/map/map.json`) y del escenario
 * del runner (`assets/images/runner/runner.json`) y los normaliza. **No guarda nada en caché**: esos archivos se regeneran
 * mientras se revisan (`tools/stream-assets/export_pack.py`, `export_map.py`), así que cada carga los vuelve a pedir.
 */
@Injectable({ providedIn: 'root' })
export class PackAssetsService {
  static readonly PACK_BASE = 'assets/images/pack/';
  static readonly MAP_BASE = 'assets/images/map/';
  static readonly RUNNER_BASE = 'assets/images/runner/';

  /** `fresh` = pedirlos saltándose la caché del navegador (botón «Recargar»). */
  async load(options: { fresh?: boolean } = {}): Promise<PackAssets> {
    const version = options.fresh ? `v=${Date.now()}` : '';
    const [pack, map, runner] = await Promise.all([
      this.readJson(`${PackAssetsService.PACK_BASE}pack.json`, version),
      this.readJson(`${PackAssetsService.MAP_BASE}map.json`, version),
      this.readJson(`${PackAssetsService.RUNNER_BASE}runner.json`, version),
    ]);
    const missing: PackAssets['missing'] = [];
    if (pack === null) missing.push('pack');
    if (map === null) missing.push('map');
    if (runner === null) missing.push('runner');
    return {
      characters: normalizePack(pack),
      map: normalizeMap(map),
      backdrop: normalizeRunnerBackdrop(runner),
      missing,
      version,
    };
  }

  /** URL de un archivo de una de las carpetas, con la versión si se recargó. */
  static url(base: string, file: string, version = ''): string {
    return `${base}${file}${version ? `?${version}` : ''}`;
  }

  /**
   * De las URLs dadas, las que no cargan como imagen (404, archivo roto…), en el mismo orden. Las prueba con `Image()` a la
   * vez; sirve para avisar «falta X» en vez de dejar el hueco vacío.
   */
  async brokenImages(urls: string[]): Promise<string[]> {
    if (typeof Image === 'undefined') return [];
    const loads = await Promise.all(
      urls.map(
        (url) =>
          new Promise<boolean>((resolve) => {
            const image = new Image();
            image.onload = () => resolve(true);
            image.onerror = () => resolve(false);
            image.src = url;
          }),
      ),
    );
    return urls.filter((_, i) => !loads[i]);
  }

  /**
   * Alto visible del primer cuadro (`frameW × frameH`, arriba a la izquierda) de una tira: lo pinta en un `canvas` y cuenta de
   * la primera a la última fila con algo opaco. `null` si la imagen no carga o no hay `canvas` (jsdom).
   */
  async visibleHeight(url: string, frameW: number, frameH: number): Promise<number | null> {
    if (typeof Image === 'undefined' || typeof document === 'undefined' || frameW <= 0 || frameH <= 0) return null;
    const image = await new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
    if (!image) return null;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = frameW;
      canvas.height = frameH;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return null;
      context.drawImage(image, 0, 0, frameW, frameH, 0, 0, frameW, frameH);
      const rgba = context.getImageData(0, 0, frameW, frameH).data;
      const alpha = new Uint8ClampedArray(frameW * frameH);
      for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];
      return opaqueHeight(alpha, frameW, frameH);
    } catch {
      return null;
    }
  }

  /** El JSON del archivo, o `null` si no existe, no hay red o no es JSON. */
  private async readJson(path: string, version: string): Promise<unknown> {
    try {
      const response = await fetch(version ? `${path}?${version}` : path, version ? { cache: 'no-store' } : undefined);
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }
}
