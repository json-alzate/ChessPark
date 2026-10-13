/** Una animación: tira horizontal de cuadros del mismo tamaño. El ancla es (0.5, 1): centro y pies. */
export interface SpriteDef {
  file: string;
  frameW: number;
  frameH: number;
  frames: number;
  fps: number;
}

/** Lo que describe `assets/scene/scene.json`: tamaño lógico, fondos y tiras. */
export interface SceneManifest {
  logical: { w: number; h: number };
  backgrounds: { day: string; night: string };
  sprites: Record<string, SpriteDef>;
}

export const SCENE_ASSETS_URL = 'assets/scene/';

export async function loadSceneManifest(): Promise<SceneManifest> {
  const response = await fetch(`${SCENE_ASSETS_URL}scene.json`);
  if (!response.ok) {
    throw new Error(`No se pudo cargar la escena (${response.status})`);
  }
  return (await response.json()) as SceneManifest;
}
