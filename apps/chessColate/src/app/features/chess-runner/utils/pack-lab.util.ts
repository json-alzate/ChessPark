import {
  MapNodeState,
  MapPoint,
  MapSprite,
  MapZone,
  PackAnimation,
  PackCharacter,
  PackMap,
  PaperStop,
  PaperTrailPoint,
  RunnerBackdropSprite,
} from '../models/pack.model';

/**
 * Cálculos del Laboratorio de la manada: qué cuadro toca en cada instante, cómo se encadena el «Recorrido», qué sprite del
 * mapa corresponde a cada estado y por dónde va el rastro de galletas. Funciones puras (el reloj lo lleva la página).
 */

/** Lo que dura un salto en el aire (ms) y cuánto se eleva (px lógicos); el salto se controla por fases, no por fps. */
export const LAB_JUMP_MS = 900;
export const LAB_JUMP_HEIGHT = 34;
/** Al repetir el salto, lo que se queda en el suelo entre uno y otro. */
export const LAB_JUMP_REST_MS = 400;

/** El «Recorrido»: las animaciones encadenadas y cuánto dura cada una (ms). */
export const LAB_TOUR: ReadonlyArray<readonly [anim: string, ms: number]> = [
  ['run', 2000],
  ['jump', LAB_JUMP_MS + LAB_JUMP_REST_MS],
  ['run', 1200],
  ['hurt', 1000],
  ['idle', 2000],
  ['happy', 2000],
];
export const LAB_TOUR_MS = LAB_TOUR.reduce((total, [, ms]) => total + ms, 0);

/** Lo que se dibuja de un personaje: qué tira, qué cuadro y cuánto se levanta del suelo (px lógicos, enteros). */
export interface LabPose {
  anim: string | null;
  frame: number;
  lift: number;
}

/** El cuadro de una tira en bucle a `fps` cuadros por segundo. */
export function frameAt(ms: number, fps: number, frames: number): number {
  if (frames <= 1 || fps <= 0) return 0;
  return Math.floor((Math.max(0, ms) * fps) / 1000) % frames;
}

/** Fase de un salto que empezó hace `ms`: despega (cuadro 0), cima (1) y caída (último); `null` si ya aterrizó. */
export function jumpPose(ms: number, frames: number): { frame: number; lift: number } | null {
  if (ms < 0 || ms >= LAB_JUMP_MS) return null;
  const t = ms / LAB_JUMP_MS;
  const frame = Math.min(Math.max(frames, 1) - 1, Math.floor(t * Math.max(frames, 1)));
  return { frame, lift: Math.round(4 * t * (1 - t) * LAB_JUMP_HEIGHT) };
}

/** Qué animación del «Recorrido» toca a los `ms` (en bucle) y cuánto lleva en ella. */
export function tourAt(ms: number): { anim: string; ms: number } {
  let rest = ((ms % LAB_TOUR_MS) + LAB_TOUR_MS) % LAB_TOUR_MS;
  for (const [anim, length] of LAB_TOUR) {
    if (rest < length) return { anim, ms: rest };
    rest -= length;
  }
  return { anim: LAB_TOUR[0][0], ms: 0 };
}

/** La animación pedida si el personaje la tiene; si no, la primera que tenga (`null` si no tiene ninguna). */
export function availableAnim(anim: string, animations: Record<string, PackAnimation>): string | null {
  if (anim in animations) return anim;
  return Object.keys(animations)[0] ?? null;
}

/** La pose de un personaje en la animación pedida (`tour` = el Recorrido), con el reloj en `ms`. */
export function poseAt(anim: string, animations: Record<string, PackAnimation>, ms: number): LabPose {
  if (anim === 'tour') {
    const step = tourAt(ms);
    return poseAt(step.anim, animations, step.ms);
  }
  const name = availableAnim(anim, animations);
  if (!name) return { anim: null, frame: 0, lift: 0 };
  const strip = animations[name];
  if (name === 'jump') {
    const jump = jumpPose(ms % (LAB_JUMP_MS + LAB_JUMP_REST_MS), strip.frames);
    return { anim: name, frame: jump?.frame ?? 0, lift: jump?.lift ?? 0 };
  }
  return { anim: name, frame: frameAt(ms, strip.fps, strip.frames), lift: 0 };
}

/** La pose en la carrerita: corre siempre y salta si hace menos de un salto que se pidió (`jumpMs` = ms desde el salto). */
export function racePose(animations: Record<string, PackAnimation>, ms: number, jumpMs: number | null): LabPose {
  if (jumpMs !== null && 'jump' in animations) {
    const jump = jumpPose(jumpMs, animations['jump'].frames);
    if (jump) return { anim: 'jump', ...jump };
  }
  return poseAt('run', animations, ms);
}

/** Los ms de un cuadro de la animación pedida, para el «paso a paso». */
export function stepMs(anim: string, animations: Record<string, PackAnimation>, ms: number): number {
  const name = anim === 'tour' ? availableAnim(tourAt(ms).anim, animations) : availableAnim(anim, animations);
  if (!name) return 100;
  if (name === 'jump') return LAB_JUMP_MS / Math.max(animations[name].frames, 1);
  return 1000 / animations[name].fps;
}

/** Marcas de la regla de alturas: cada `step` px lógicos hasta `max` incluido. */
export function rulerTicks(max: number, step = 10): number[] {
  const ticks: number[] = [];
  for (let h = step; h <= max; h += step) ticks.push(h);
  return ticks;
}

/** Nombre del sprite de un punto en un estado; los `done1-3` caen en `done` en los tipos sin estrellas. `null` si no hay. */
export function nodeSpriteName(kind: string, state: MapNodeState, sprites: Record<string, MapSprite>): string | null {
  const candidates = [`map-node-${kind}-${state}`];
  if (state.startsWith('done')) candidates.push(`map-node-${kind}-done`, `map-node-${kind}-done3`);
  return candidates.find((name) => name in sprites) ?? null;
}

/** Puntitos del camino entre cada par de puntos seguidos, cada `spacing` px y sin pisar los nodos (`clear` px de radio). */
export function pathDots(points: MapPoint[], spacing = 10, clear = 12): Array<{ x: number; y: number; segment: number }> {
  const dots: Array<{ x: number; y: number; segment: number }> = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    for (let d = clear; d <= length - clear; d += spacing) {
      dots.push({ x: Math.round(a.x + ((b.x - a.x) * d) / length), y: Math.round(a.y + ((b.y - a.y) * d) / length), segment: i });
    }
  }
  return dots;
}

/** Variantes del papel que existan (`paper-map-d0`, `d1`…, o `paper-map` a secas), en orden. */
export function paperVariants(sprites: Record<string, MapSprite>): string[] {
  return Object.keys(sprites)
    .filter((name) => /^paper-map(-d\d+)?$/.test(name))
    .sort();
}

/**
 * La galleta de cada checkpoint del rastro: llena hasta `progress`, dorada en el último de cada zona (el jefe). Lo de la
 * dorada al final de la zona es solo una convención del laboratorio para verla: la spec no dice dónde la usará el juego.
 */
export function trailCookie(index: number, progress: number, trail: PaperTrailPoint[], sprites: Record<string, MapSprite>): string | null {
  const pick = (...names: string[]) => names.find((name) => name in sprites) ?? null;
  if (index >= progress) return pick('cookie-board-empty', 'cookie-board');
  const zoneEnd = index === trail.length - 1 || trail[index + 1]?.zone !== trail[index]?.zone;
  return zoneEnd ? pick('cookie-gold', 'cookie-board') : pick('cookie-board');
}

/**
 * Dónde va la huella de la manada: en el último checkpoint alcanzado. Si aún no hay ninguno, en la ruta justo **antes** de la
 * primera parada (a `clear` px de su centro, del lado contrario al primer checkpoint) para no tapar la cara del jefe: 16 =
 * media parada (10) + media huella (6). Sin rastro, en la parada; sin parada, en el primer checkpoint. El centro se limita a
 * `[half, paper.w − half]` × `[half, paper.h − half]` para que la huella entera (12×12, `half` = 6) quede dentro del papel.
 */
export function markerAt(
  progress: number,
  trail: PaperTrailPoint[],
  stops: PaperStop[],
  paper: { w: number; h: number },
  clear = 16,
  half = 6,
): { x: number; y: number } | null {
  // si el papel es más chico que la huella, queda pegada a la esquina de arriba a la izquierda
  const inside = (v: number, size: number) => Math.max(half, Math.min(Math.max(half, size - half), v));
  const at = (x: number, y: number) => ({ x: inside(x, paper.w), y: inside(y, paper.h) });
  if (progress > 0 && trail.length) {
    const t = trail[Math.min(progress, trail.length) - 1];
    return at(t.x, t.y);
  }
  const stop = stops[0];
  if (!stop) return trail[0] ? at(trail[0].x, trail[0].y) : null;
  const next = trail[0];
  const length = next ? Math.hypot(next.x - stop.x, next.y - stop.y) : 0;
  if (!next || length === 0) return at(stop.x, stop.y);
  return at(
    Math.round(stop.x - ((next.x - stop.x) * clear) / length),
    Math.round(stop.y - ((next.y - stop.y) * clear) / length),
  );
}

/**
 * El zoom entero con el que se pinta algo de `logicalW` px lógicos en `availableW` px: el pedido, salvo que no quepa a lo
 * ancho, y entonces el mayor que quepa (mínimo 1). Con `availableW` desconocido (0) se queda el pedido; con un zoom que no es
 * un número finito (`NaN`, `Infinity`), 1.
 */
export function fitScale(zoom: number, logicalW: number, availableW: number): number {
  const wanted = Number.isFinite(zoom) ? Math.max(1, Math.round(zoom)) : 1;
  if (!(availableW > 0) || !(logicalW > 0)) return wanted;
  return Math.max(1, Math.min(wanted, Math.floor(availableW / logicalW)));
}

/** Sprite de una parada del papel según su zona esté abierta o cerrada (`null` si no hay). */
export function paperStopSprite(boss: string, open: boolean, sprites: Record<string, MapSprite>): string | null {
  const name = `paper-stop-${boss}-${open ? 'open' : 'locked'}`;
  return name in sprites ? name : null;
}

/**
 * La zona de la parada `index` del papel: la que tenga su mismo jefe (`zone.boss === stop.boss`) y, si ninguna lo tiene, la de
 * su número de orden (`index + 1`: las paradas van de la zona 1 a la 7). No se usa la posición en la lista de zonas: si se
 * exportan zonas sueltas (1, 2 y 7), la tercera parada no debe quedar unida a la zona 7.
 */
export function stopZoneId(stops: PaperStop[], index: number, zones: MapZone[]): string {
  const stop = stops[index];
  const byBoss = stop ? zones.find((z) => z.boss !== null && z.boss === stop.boss) : undefined;
  return byBoss?.id ?? String(index + 1);
}

/** Un PNG que pinta el laboratorio y la carpeta en la que vive. */
export interface LabImage {
  folder: 'pack' | 'map' | 'runner';
  file: string;
}

/** Todos los PNG que usan los manifiestos (tiras, retratos, sprites del mapa y fondos del runner), sin repetir. */
export function labImages(assets: {
  characters: PackCharacter[];
  map: PackMap;
  backdrop: Record<string, RunnerBackdropSprite>;
}): LabImage[] {
  const seen = new Set<string>();
  const out: LabImage[] = [];
  const add = (folder: LabImage['folder'], file: string | null | undefined) => {
    if (!file || seen.has(`${folder}/${file}`)) return;
    seen.add(`${folder}/${file}`);
    out.push({ folder, file });
  };
  for (const c of assets.characters) {
    add('pack', c.portrait);
    for (const name of c.animationNames) add('pack', c.animations[name]?.file);
  }
  for (const sprite of Object.values(assets.map.sprites)) add('map', sprite.file);
  for (const zone of assets.map.zones) for (const fx of zone.ambient) add('map', fx.file);
  for (const sprite of Object.values(assets.backdrop)) add('runner', sprite.file);
  return out;
}

/**
 * Alto visible de un cuadro: de la primera a la última fila con algún píxel opaco (alfa > 0), ambas incluidas. `alpha` es
 * el canal alfa fila a fila (`width × height` valores). Sin nada opaco da 0.
 */
export function opaqueHeight(alpha: ArrayLike<number>, width: number, height: number): number {
  let first = -1;
  let last = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha[y * width + x] > 0) {
        if (first < 0) first = y;
        last = y;
        break;
      }
    }
  }
  return first < 0 ? 0 : last - first + 1;
}
