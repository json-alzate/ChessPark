/**
 * Manifiestos de prueba del Laboratorio de la manada, con la forma que escriben `tools/stream-assets/export_pack.py` y
 * `export_map.py`: la manada con un solo personaje (como hoy) y con varios; el mapa vacío (como hoy) y con una zona falsa.
 */

const animaciones = (id: string) => ({
  run: { file: `pack-${id}-run.png`, frames: 4, fps: 12 },
  jump: { file: `pack-${id}-jump.png`, frames: 3, fps: 1 },
  hurt: { file: `pack-${id}-hurt.png`, frames: 2, fps: 8 },
  happy: { file: `pack-${id}-happy.png`, frames: 2, fps: 6 },
  idle: { file: `pack-${id}-idle.png`, frames: 2, fps: 3 },
});

export const CHOCO = {
  name: 'Choco',
  family: 'lab',
  size: 'M',
  collar: '#7fd35a',
  cellW: 54,
  cellH: 43,
  animations: animaciones('choco'),
  portrait: 'pack-choco-portrait.png',
};

export const PACK_UNO = { version: 1, characters: { choco: CHOCO } };

export const PACK_VARIOS = {
  version: 1,
  characters: {
    choco: CHOCO,
    nannukk: {
      name: 'Nannukk',
      family: 'malamute',
      size: 'XL',
      collar: '#ee6f86',
      cellW: 70,
      cellH: 57,
      animations: { ...animaciones('nannukk'), wag: { file: 'pack-nannukk-wag.png', frames: 3, fps: 5 } },
      portrait: 'pack-nannukk-portrait.png',
    },
    // Sin retrato todavía y solo con dos animaciones
    luna: {
      name: 'Luna',
      size: 'S',
      collar: '#36d1c4',
      cellW: 40,
      cellH: 31,
      animations: { idle: { file: 'pack-luna-idle.png', frames: 2, fps: 3 }, run: { file: 'pack-luna-run.png', frames: 4, fps: 12 } },
    },
  },
};

export const MAP_VACIO = {
  version: 1,
  logical: { zoneW: 220, zoneH: 420, paperW: 220, paperH: 320 },
  zones: {},
  nodes: {},
  paper: {},
  sprites: {},
};

const sprite = (file: string, frameW: number, frameH: number, frames = 1) => ({ file, frameW, frameH, frames });

export const MAP_ZONA = {
  version: 1,
  logical: { zoneW: 220, zoneH: 420, paperW: 220, paperH: 320 },
  zones: {
    '1': {
      name: 'Bosque',
      boss: 'ardilla',
      darkness: 0,
      scene: 'map-zone-1',
      // Desordenados a propósito: se ordenan por `order`
      points: [
        { x: 110, y: 60, kind: 'boss', order: 3 },
        { x: 60, y: 380, kind: 'pattern', order: 1 },
        { x: 150, y: 220, kind: 'camp', order: 2 },
      ],
      ambient: [
        { sprite: 'map-fx-1-hojas', x: 20, y: 30, fps: 4, file: 'map-fx-1-hojas.png', frames: 4, frameW: 16, frameH: 16 },
      ],
    },
  },
  nodes: {},
  paper: {
    stops: [{ boss: 'ardilla', x: 40, y: 280 }],
    trail: [
      { x: 50, y: 270, zone: '1' },
      { x: 60, y: 260, zone: '1' },
      { x: 70, y: 250, zone: '2' },
    ],
  },
  sprites: {
    'map-zone-1': sprite('map-zone-1.png', 220, 420),
    'map-fx-1-hojas': sprite('map-fx-1-hojas.png', 16, 16, 4),
    'map-node-pattern-open': sprite('map-node-pattern-open.png', 20, 20, 2),
    'map-node-pattern-done2': sprite('map-node-pattern-done2.png', 20, 20),
    'map-node-boss-open': sprite('map-node-boss-open.png', 20, 20, 2),
    'map-node-camp-done': sprite('map-node-camp-done.png', 20, 20),
    'paper-map-d0': sprite('paper-map-d0.png', 220, 320),
    'paper-map-d1': sprite('paper-map-d1.png', 220, 320),
    'cookie-board': sprite('cookie-board.png', 10, 10),
    'cookie-board-empty': sprite('cookie-board-empty.png', 10, 10),
    'cookie-gold': sprite('cookie-gold.png', 10, 10),
    'paper-stop-ardilla-open': sprite('paper-stop-ardilla-open.png', 20, 20),
    'paper-stop-ardilla-locked': sprite('paper-stop-ardilla-locked.png', 20, 20),
    'paper-marker': sprite('paper-marker.png', 12, 12, 2),
  },
};
