import { Injectable } from '@angular/core';

/** Una tira de cuadros de la hoja de sprites del runner. */
export interface RunnerSprite {
  image: CanvasImageSource;
  frameW: number;
  frameH: number;
  frames: number;
  fps: number;
}

interface RunnerManifest {
  sprites: Record<string, { file: string; frameW: number; frameH: number; frames: number; fps: number }>;
}

/**
 * Carga los assets pixel-art del runner (los genera `tools/stream-assets/export_runner.py`): lee
 * `runner.json` y baja cada tira una sola vez; las siguientes carreras la reutilizan.
 */
@Injectable({ providedIn: 'root' })
export class RunnerSpritesService {
  private readonly BASE = 'assets/images/runner/';
  private cache: Promise<Map<string, RunnerSprite>> | null = null;

  load(): Promise<Map<string, RunnerSprite>> {
    if (!this.cache) {
      this.cache = this.fetchAll().catch((error) => {
        // Que un fallo de red no deje la carga fallida para siempre: la próxima vez se reintenta
        this.cache = null;
        throw error;
      });
    }
    return this.cache;
  }

  private async fetchAll(): Promise<Map<string, RunnerSprite>> {
    const response = await fetch(`${this.BASE}runner.json`);
    if (!response.ok) {
      throw new Error(`No se pudo cargar runner.json (${response.status})`);
    }
    const manifest = (await response.json()) as RunnerManifest;

    const entries = await Promise.all(
      Object.entries(manifest.sprites).map(async ([name, sprite]) => {
        const image = await this.loadImage(`${this.BASE}${sprite.file}`);
        const loaded: RunnerSprite = {
          image,
          frameW: sprite.frameW,
          frameH: sprite.frameH,
          frames: sprite.frames,
          fps: sprite.fps,
        };
        return [name, loaded] as const;
      })
    );
    return new Map(entries);
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
      image.src = src;
    });
  }
}
