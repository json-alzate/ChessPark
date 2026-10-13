/**
 * Guion de la escena como función pura del tiempo.
 *
 * `sceneAt(ahora)` dice qué hay en pantalla y dónde, sin guardar estado: si el runner
 * se reinicia, la escena retoma donde toca. Es lo mismo que pide el doc para el
 * programa de temas. Los renderizadores (CSS, Phaser) solo dibujan lo que esto devuelve.
 */

/** Coordenadas lógicas: el lienzo es de 960×540 y la página lo escala ×2. */
export interface Actor {
  visible: boolean;
  /** Nombre de la tira de animación (ver scene.json). */
  sprite: string;
  /** Centro horizontal y pies, en píxeles lógicos. */
  x: number;
  y: number;
  /** Los sprites miran a la derecha; `flip` los voltea. */
  flip: boolean;
}

export interface CloudState {
  sprite: string;
  x: number;
  y: number;
}

export interface SceneSnapshot {
  /** 0 = día, 1 = noche. */
  night: number;
  dog: Actor;
  cat: Actor;
  hand: Actor;
  bone: Actor;
  heart: Actor;
  hole: Actor;
}

/** Duración del guion del perro, en segundos; se repite. */
export const CYCLE_S = 96;

interface DogSegment {
  at: number;
  len: number;
  sprite: string;
  x0: number;
  x1: number;
  flip?: boolean;
}

// Chocolate: se sienta, pasea, ladra al gato cuando aparece, cava, corre por el hueso y duerme.
const DOG_SCRIPT: readonly DogSegment[] = [
  { at: 0, len: 6, sprite: 'dog-sit', x0: 300, x1: 300 },
  { at: 6, len: 7, sprite: 'dog-walk', x0: 300, x1: 520 },
  { at: 13, len: 5, sprite: 'dog-sit', x0: 520, x1: 520 },
  { at: 18, len: 3, sprite: 'dog-run', x0: 520, x1: 600 },
  { at: 21, len: 17, sprite: 'dog-bark', x0: 600, x1: 600 },
  { at: 38, len: 4, sprite: 'dog-sit', x0: 600, x1: 600 },
  { at: 42, len: 6, sprite: 'dog-walk', x0: 600, x1: 406, flip: true },
  { at: 48, len: 12, sprite: 'dog-dig', x0: 406, x1: 406 },
  { at: 60, len: 4, sprite: 'dog-sit', x0: 406, x1: 406 },
  { at: 64, len: 5, sprite: 'dog-run', x0: 406, x1: 130, flip: true },
  { at: 69, len: 9, sprite: 'dog-sit', x0: 130, x1: 130, flip: true },
  { at: 78, len: 9, sprite: 'dog-walk', x0: 130, x1: 300 },
  { at: 87, len: 4, sprite: 'dog-sit', x0: 300, x1: 300 },
  { at: 91, len: 5, sprite: 'dog-sleep', x0: 300, x1: 300 },
];

const DOG_FEET_Y = 528;

/** Ventanas de tiempo (segundos del ciclo) de los demás elementos. */
const CAT_WINDOW = [18, 40] as const;
const HEART_WINDOW = [24, 27] as const;
const HAND_WINDOW = [63, 68] as const;
const BONE_WINDOW = [66, 78] as const;

const inWindow = (t: number, [from, to]: readonly [number, number]): boolean => t >= from && t < to;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const k = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return k * k * (3 - 2 * k);
}

/** Cuánta noche hay en un punto del día (0..1). Amanecer y atardecer son transiciones suaves. */
export function nightAt(nowMs: number, dayMs: number): number {
  const p = (nowMs % dayMs) / dayMs;
  const dusk = smoothstep(0.42, 0.55, p);
  const dawn = 1 - smoothstep(0.9, 1, p);
  return Math.min(dusk, dawn);
}

export function sceneAt(nowMs: number, dayMs = 75 * 60_000): SceneSnapshot {
  const t = (nowMs / 1000) % CYCLE_S;

  const seg = DOG_SCRIPT.find((s) => t >= s.at && t < s.at + s.len) ?? DOG_SCRIPT[0];
  const k = (t - seg.at) / seg.len;
  const dogX = seg.x0 + (seg.x1 - seg.x0) * k;
  const digging = seg.sprite === 'dog-dig';

  // El hoyo nace cuando Chocolate cava y se va cerrando solo.
  let holeSprite = 'hole-open';
  let holeVisible = true;
  if (t < 50) {
    holeVisible = false;
  } else if (t >= 92) {
    holeVisible = false;
  } else if (t >= 88) {
    holeSprite = 'hole-mound';
  } else if (t >= 84) {
    holeSprite = 'hole-half';
  }

  return {
    night: nightAt(nowMs, dayMs),
    dog: { visible: true, sprite: seg.sprite, x: dogX, y: DOG_FEET_Y, flip: seg.flip ?? false },
    cat: { visible: inWindow(t, CAT_WINDOW), sprite: 'cat-tease', x: 687, y: 460, flip: false },
    hand: { visible: inWindow(t, HAND_WINDOW), sprite: 'hand', x: 103, y: 445, flip: false },
    bone: { visible: inWindow(t, BONE_WINDOW), sprite: 'bone', x: 99, y: 517, flip: false },
    heart: { visible: inWindow(t, HEART_WINDOW), sprite: 'heart', x: 650, y: 500, flip: false },
    hole: { visible: holeVisible && (digging || t >= 50), sprite: holeSprite, x: 429, y: 530, flip: false },
  };
}

/** Nubes: derivan lentamente de izquierda a derecha y dan la vuelta. */
export interface CloudDef {
  sprite: string;
  y: number;
  /** Posición inicial en píxeles lógicos. */
  x0: number;
  /** Píxeles lógicos por segundo. */
  speed: number;
}

export const CLOUDS: readonly CloudDef[] = [
  { sprite: 'cloud-0', y: 50, x0: 30, speed: 6 },
  { sprite: 'cloud-1', y: 100, x0: 400, speed: 9 },
  { sprite: 'cloud-2', y: 230, x0: 700, speed: 4 },
];

/** Posición horizontal de una nube en un instante; recorre el lienzo y reaparece por el otro lado. */
export function cloudX(def: CloudDef, nowMs: number, stageW: number, cloudW: number): number {
  const span = stageW + cloudW * 2;
  const travelled = def.x0 + cloudW + (def.speed * nowMs) / 1000;
  return (travelled % span) - cloudW;
}
