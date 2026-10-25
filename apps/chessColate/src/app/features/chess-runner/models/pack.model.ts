/**
 * La manada y el mapa del Chess Runner tal como los describen `assets/images/pack/pack.json` y
 * `assets/images/map/map.json` (los escriben `tools/stream-assets/export_pack.py` y `export_map.py`; contrato en
 * `docs/personajes/ASSETS_SPEC.md`). Son las formas **ya normalizadas**: lo que falta en el manifiesto llega vacío.
 */

/** Una animación del personaje: una tira horizontal de cuadros del tamaño de la celda. */
export interface PackAnimation {
  file: string;
  frames: number;
  fps: number;
}

export interface PackCharacter {
  id: string;
  name: string;
  family: string | null;
  /** Talla (S, M, L, XL…); provisional. */
  size: string | null;
  /** Color del collar (`#rrggbb`); provisional. */
  collar: string | null;
  /** Celda única de todas sus animaciones (px lógicos). */
  cellW: number;
  cellH: number;
  /** Animaciones en orden: primero las obligatorias (run, jump, hurt, idle, happy) y luego las demás. */
  animations: Record<string, PackAnimation>;
  animationNames: string[];
  /** Retrato de 32×32 (archivo) o `null` si aún no hay. */
  portrait: string | null;
}

/** Una tira del mapa (escena, nodo, galleta…): `sprites` de `map.json`. */
export interface MapSprite {
  file: string;
  frameW: number;
  frameH: number;
  frames: number;
}

export interface MapPoint {
  /** Centro del nodo, en px lógicos de la escena. */
  x: number;
  y: number;
  kind: string;
  order: number;
}

/** Una animación de ambiente encima de la escena (esquina superior izquierda). */
export interface MapAmbient extends MapSprite {
  sprite: string;
  x: number;
  y: number;
  fps: number;
}

export interface MapZone {
  id: string;
  name: string;
  boss: string | null;
  darkness: number;
  /** Nombre del sprite de la escena (`map-zone-<n>`) o `null`. */
  scene: string | null;
  points: MapPoint[];
  ambient: MapAmbient[];
}

export interface PaperStop {
  boss: string;
  x: number;
  y: number;
}

export interface PaperTrailPoint {
  x: number;
  y: number;
  zone: string;
}

export interface PackMap {
  logical: { zoneW: number; zoneH: number; paperW: number; paperH: number };
  zones: MapZone[];
  sprites: Record<string, MapSprite>;
  paper: { stops: PaperStop[]; trail: PaperTrailPoint[] };
}

/** Lo que se ve de un punto del mapa: los estados de `map-node-<kind>-<estado>`. */
export type MapNodeState = 'locked' | 'open' | 'current' | 'done1' | 'done2' | 'done3';
export const MAP_NODE_STATES: readonly MapNodeState[] = ['locked', 'open', 'current', 'done1', 'done2', 'done3'];

/** Una tira del escenario del runner (`assets/images/runner/runner.json`) que sirve de fondo. */
export interface RunnerBackdropSprite {
  file: string;
  frameW: number;
  frameH: number;
}
