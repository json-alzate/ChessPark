import {
  MAP_LOGICAL_DEFAULT,
  normalizeMap,
  normalizePack,
  normalizeRunnerBackdrop,
} from '@features/chess-runner/utils/pack-manifest.util';

import { MAP_VACIO, MAP_ZONA, PACK_UNO, PACK_VARIOS } from '@tests/support/pack-lab';

describe('normalizePack', () => {
  it('con un solo personaje devuelve ese, con sus datos y sus animaciones en el orden de siempre', () => {
    const [choco, ...resto] = normalizePack(PACK_UNO);

    expect(resto).toEqual([]);
    expect(choco).toMatchObject({ id: 'choco', name: 'Choco', size: 'M', collar: '#7fd35a', cellW: 54, cellH: 43 });
    expect(choco.portrait).toBe('pack-choco-portrait.png');
    expect(choco.animationNames).toEqual(['run', 'jump', 'hurt', 'idle', 'happy']);
    expect(choco.animations['run']).toEqual({ file: 'pack-choco-run.png', frames: 4, fps: 12 });
  });

  it('con varios los devuelve todos, en el orden del archivo, sin lista fija', () => {
    expect(normalizePack(PACK_VARIOS).map((c) => c.id)).toEqual(['choco', 'nannukk', 'luna']);
  });

  it('una animación nueva va detrás de las obligatorias y lo que falta llega vacío', () => {
    const [, nannukk, luna] = normalizePack(PACK_VARIOS);

    expect(nannukk.animationNames).toEqual(['run', 'jump', 'hurt', 'idle', 'happy', 'wag']);
    expect(luna.animationNames).toEqual(['run', 'idle']);
    expect(luna.portrait).toBeNull();
    expect(luna.family).toBeNull();
  });

  it('descarta el personaje sin celda o sin ninguna animación válida, y la animación rota', () => {
    const pack = normalizePack({
      characters: {
        sinCelda: { animations: { run: { file: 'a.png', frames: 4, fps: 12 } } },
        sinAnimaciones: { cellW: 30, cellH: 30, animations: { run: { frames: 4 } } },
        bueno: { cellW: 30, cellH: 30, animations: { run: { file: 'r.png', frames: 4 }, rota: { file: 'x.png', frames: 0 } } },
      },
    });

    expect(pack.map((c) => c.id)).toEqual(['bueno']);
    expect(pack[0].animationNames).toEqual(['run']);
    // sin fps, uno razonable en vez de una animación congelada
    expect(pack[0].animations['run'].fps).toBeGreaterThan(0);
    expect(pack[0].name).toBe('bueno');
  });

  it('un manifiesto ausente o roto da una manada vacía', () => {
    expect(normalizePack(null)).toEqual([]);
    expect(normalizePack('no es json')).toEqual([]);
    expect(normalizePack({ version: 1 })).toEqual([]);
  });
});

describe('normalizeMap', () => {
  it('el mapa vacío de hoy no tiene zonas ni papel, pero sí las medidas lógicas', () => {
    const mapa = normalizeMap(MAP_VACIO);

    expect(mapa.zones).toEqual([]);
    expect(mapa.paper).toEqual({ stops: [], trail: [] });
    expect(mapa.sprites).toEqual({});
    expect(mapa.logical).toEqual(MAP_LOGICAL_DEFAULT);
  });

  it('sin archivo se queda con las medidas por defecto', () => {
    expect(normalizeMap(null)).toEqual({ logical: MAP_LOGICAL_DEFAULT, zones: [], sprites: {}, paper: { stops: [], trail: [] } });
  });

  it('una zona trae su nombre, jefe, oscuridad, escena, puntos ordenados y ambientes', () => {
    const [zona] = normalizeMap(MAP_ZONA).zones;

    expect(zona).toMatchObject({ id: '1', name: 'Bosque', boss: 'ardilla', darkness: 0, scene: 'map-zone-1' });
    expect(zona.points.map((p) => p.order)).toEqual([1, 2, 3]);
    expect(zona.points.map((p) => p.kind)).toEqual(['pattern', 'camp', 'boss']);
    expect(zona.ambient).toEqual([
      { sprite: 'map-fx-1-hojas', x: 20, y: 30, fps: 4, file: 'map-fx-1-hojas.png', frames: 4, frameW: 16, frameH: 16 },
    ]);
  });

  it('ordena las zonas por número aunque vengan como texto', () => {
    const zonas = normalizeMap({ zones: { '10': {}, '2': {}, '1': {} } }).zones;

    expect(zonas.map((z) => z.id)).toEqual(['1', '2', '10']);
  });

  it('un ambiente sin medidas las toma de sprites, y uno que no existe se descarta', () => {
    const [zona] = normalizeMap({
      zones: { '1': { ambient: [{ sprite: 'map-fx-1-a', x: 1, y: 2, fps: 3 }, { sprite: 'map-fx-1-nada', x: 1, y: 2 }] } },
      sprites: { 'map-fx-1-a': { file: 'map-fx-1-a.png', frameW: 8, frameH: 6, frames: 3 } },
    }).zones;

    expect(zona.ambient).toEqual([{ sprite: 'map-fx-1-a', x: 1, y: 2, fps: 3, file: 'map-fx-1-a.png', frameW: 8, frameH: 6, frames: 3 }]);
  });

  it('lee las paradas y el rastro del papel, y salta los puntos rotos', () => {
    const { paper } = normalizeMap({
      ...MAP_ZONA,
      paper: { stops: [...MAP_ZONA.paper.stops, { x: 1 }], trail: [...MAP_ZONA.paper.trail, { zone: '3' }] },
    });

    expect(paper.stops).toEqual([{ boss: 'ardilla', x: 40, y: 280 }]);
    expect(paper.trail).toHaveLength(3);
    expect(paper.trail[2]).toEqual({ x: 70, y: 250, zone: '2' });
  });
});

describe('normalizeRunnerBackdrop', () => {
  it('se queda solo con las tiras del escenario (scene-*)', () => {
    const fondo = normalizeRunnerBackdrop({
      sprites: {
        'dog-run': { file: 'dog-run.png', frameW: 52, frameH: 40, frames: 4, fps: 12 },
        'scene-floor': { file: 'scene-floor.png', frameW: 32, frameH: 20, frames: 1, fps: 1 },
      },
    });

    expect(fondo).toEqual({ 'scene-floor': { file: 'scene-floor.png', frameW: 32, frameH: 20 } });
    expect(normalizeRunnerBackdrop(undefined)).toEqual({});
  });
});
