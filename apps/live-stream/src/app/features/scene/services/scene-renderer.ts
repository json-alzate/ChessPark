import { SceneManifest } from './scene-manifest';

export type RendererKind = 'none' | 'css';

export interface RendererOptions {
  /** Duración del ciclo día/noche, en ms. */
  dayMs: number;
  /** Cuántas veces por segundo se actualiza la escena. */
  fps: number;
}

/**
 * Dibuja el guion de `scene-timeline`. Cada implementación es dueña de su propio reloj:
 * se monta sobre un contenedor de 960×540 y la página lo escala ×2.
 */
export interface SceneRenderer {
  mount(host: HTMLElement, manifest: SceneManifest, options: RendererOptions): Promise<void>;
  destroy(): void;
}

export function parseRendererKind(value: string | null): RendererKind {
  switch (value) {
    case 'css':
    case 'none':
      return value;
    default:
      return 'css';
  }
}

export async function createRenderer(kind: RendererKind): Promise<SceneRenderer | null> {
  switch (kind) {
    case 'none':
      return null;
    case 'css': {
      const { CssSceneRenderer } = await import('./css-scene-renderer');
      return new CssSceneRenderer();
    }
  }
}
