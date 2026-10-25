import {
  MapAmbient,
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
 * Normaliza los manifiestos de la manada (`pack.json`) y del mapa (`map.json`) sin listas fijas: lo que traiga el archivo es lo
 * que se pinta, y lo que falte (o venga roto) se deja vacío en vez de romper la pantalla. Funciones puras.
 */

/** Las animaciones obligatorias, en el orden en que se muestran; las demás van detrás, por nombre. */
export const PACK_ANIMATIONS = ['run', 'jump', 'hurt', 'idle', 'happy'] as const;

/** Medidas lógicas por defecto del mapa (las de `export_map.py`). */
export const MAP_LOGICAL_DEFAULT = { zoneW: 220, zoneH: 420, paperW: 220, paperH: 320 };

type Raw = Record<string, unknown>;

const isObject = (value: unknown): value is Raw => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);
const finite = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const positiveInt = (value: unknown): number | null => {
  const n = finite(value);
  return n !== null && n >= 1 ? Math.floor(n) : null;
};

function animation(raw: unknown): PackAnimation | null {
  if (!isObject(raw)) return null;
  const file = text(raw['file']);
  const frames = positiveInt(raw['frames']);
  if (!file || !frames) return null;
  const fps = finite(raw['fps']);
  return { file, frames, fps: fps && fps > 0 ? fps : 8 };
}

function character(id: string, raw: unknown): PackCharacter | null {
  if (!isObject(raw)) return null;
  const cellW = positiveInt(raw['cellW']);
  const cellH = positiveInt(raw['cellH']);
  if (!cellW || !cellH) return null;
  const animations: Record<string, PackAnimation> = {};
  if (isObject(raw['animations'])) {
    for (const [name, value] of Object.entries(raw['animations'])) {
      const parsed = animation(value);
      if (parsed) animations[name] = parsed;
    }
  }
  const known = PACK_ANIMATIONS.filter((name) => name in animations) as string[];
  const others = Object.keys(animations)
    .filter((name) => !known.includes(name))
    .sort();
  const animationNames = [...known, ...others];
  if (!animationNames.length) return null;
  return {
    id,
    name: text(raw['name']) ?? id,
    family: text(raw['family']),
    size: text(raw['size']),
    collar: text(raw['collar']),
    cellW,
    cellH,
    animations,
    animationNames,
    portrait: text(raw['portrait']),
  };
}

/** Los personajes de `pack.json`, en el orden del archivo. Un personaje sin celda o sin animaciones válidas se descarta. */
export function normalizePack(raw: unknown): PackCharacter[] {
  if (!isObject(raw) || !isObject(raw['characters'])) return [];
  return Object.entries(raw['characters'])
    .map(([id, value]) => character(id, value))
    .filter((c): c is PackCharacter => c !== null);
}

function sprite(raw: unknown): MapSprite | null {
  if (!isObject(raw)) return null;
  const file = text(raw['file']);
  const frameW = positiveInt(raw['frameW']);
  const frameH = positiveInt(raw['frameH']);
  if (!file || !frameW || !frameH) return null;
  return { file, frameW, frameH, frames: positiveInt(raw['frames']) ?? 1 };
}

function point(raw: unknown, index: number): MapPoint | null {
  if (!isObject(raw)) return null;
  const x = finite(raw['x']);
  const y = finite(raw['y']);
  if (x === null || y === null) return null;
  return { x, y, kind: text(raw['kind']) ?? 'pattern', order: finite(raw['order']) ?? index + 1 };
}

function ambient(raw: unknown, sprites: Record<string, MapSprite>): MapAmbient | null {
  if (!isObject(raw)) return null;
  const name = text(raw['sprite']);
  const x = finite(raw['x']);
  const y = finite(raw['y']);
  if (!name || x === null || y === null) return null;
  // El exportador copia file/frames/frameW/frameH en cada ambiente; si faltan, se sacan de `sprites`
  const strip = sprite(raw) ?? sprites[name] ?? null;
  if (!strip) return null;
  const fps = finite(raw['fps']);
  return { ...strip, frames: positiveInt(raw['frames']) ?? strip.frames, sprite: name, x, y, fps: fps && fps > 0 ? fps : 4 };
}

function zone(id: string, raw: unknown, sprites: Record<string, MapSprite>): MapZone | null {
  if (!isObject(raw)) return null;
  const points = (Array.isArray(raw['points']) ? raw['points'] : [])
    .map((p, i) => point(p, i))
    .filter((p): p is MapPoint => p !== null)
    .sort((a, b) => a.order - b.order);
  const ambients = (Array.isArray(raw['ambient']) ? raw['ambient'] : [])
    .map((a) => ambient(a, sprites))
    .filter((a): a is MapAmbient => a !== null);
  return {
    id,
    name: text(raw['name']) ?? '',
    boss: text(raw['boss']),
    darkness: finite(raw['darkness']) ?? 0,
    scene: text(raw['scene']),
    points,
    ambient: ambients,
  };
}

const zoneOrder = (a: MapZone, b: MapZone) => {
  const na = Number(a.id);
  const nb = Number(b.id);
  return Number.isFinite(na) && Number.isFinite(nb) ? na - nb : a.id.localeCompare(b.id);
};

/** El mapa de `map.json`: zonas ordenadas por número, puntos por `order`, y el papel. Todo puede venir vacío. */
export function normalizeMap(raw: unknown): PackMap {
  const data = isObject(raw) ? raw : {};
  const logicalRaw = isObject(data['logical']) ? data['logical'] : {};
  const logical = {
    zoneW: positiveInt(logicalRaw['zoneW']) ?? MAP_LOGICAL_DEFAULT.zoneW,
    zoneH: positiveInt(logicalRaw['zoneH']) ?? MAP_LOGICAL_DEFAULT.zoneH,
    paperW: positiveInt(logicalRaw['paperW']) ?? MAP_LOGICAL_DEFAULT.paperW,
    paperH: positiveInt(logicalRaw['paperH']) ?? MAP_LOGICAL_DEFAULT.paperH,
  };

  const sprites: Record<string, MapSprite> = {};
  if (isObject(data['sprites'])) {
    for (const [name, value] of Object.entries(data['sprites'])) {
      const parsed = sprite(value);
      if (parsed) sprites[name] = parsed;
    }
  }

  const zones = isObject(data['zones'])
    ? Object.entries(data['zones'])
        .map(([id, value]) => zone(id, value, sprites))
        .filter((z): z is MapZone => z !== null)
        .sort(zoneOrder)
    : [];

  const paperRaw = isObject(data['paper']) ? data['paper'] : {};
  const stops = (Array.isArray(paperRaw['stops']) ? paperRaw['stops'] : [])
    .map((s): PaperStop | null => {
      if (!isObject(s)) return null;
      const x = finite(s['x']);
      const y = finite(s['y']);
      const boss = text(s['boss']);
      return boss && x !== null && y !== null ? { boss, x, y } : null;
    })
    .filter((s): s is PaperStop => s !== null);
  const trail = (Array.isArray(paperRaw['trail']) ? paperRaw['trail'] : [])
    .map((t): PaperTrailPoint | null => {
      if (!isObject(t)) return null;
      const x = finite(t['x']);
      const y = finite(t['y']);
      return x !== null && y !== null ? { x, y, zone: String(t['zone'] ?? '') } : null;
    })
    .filter((t): t is PaperTrailPoint => t !== null);

  return { logical, zones, sprites, paper: { stops, trail } };
}

/** Las tiras del escenario del runner (`runner.json`) que valen de fondo: las que empiezan por `scene-`. */
export function normalizeRunnerBackdrop(raw: unknown): Record<string, RunnerBackdropSprite> {
  const result: Record<string, RunnerBackdropSprite> = {};
  if (!isObject(raw) || !isObject(raw['sprites'])) return result;
  for (const [name, value] of Object.entries(raw['sprites'])) {
    const parsed = name.startsWith('scene-') ? sprite(value) : null;
    if (parsed) result[name] = { file: parsed.file, frameW: parsed.frameW, frameH: parsed.frameH };
  }
  return result;
}
