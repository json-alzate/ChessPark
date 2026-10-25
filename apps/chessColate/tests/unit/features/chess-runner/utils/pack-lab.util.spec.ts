import {
  availableAnim,
  fitScale,
  frameAt,
  jumpPose,
  LAB_JUMP_HEIGHT,
  LAB_JUMP_MS,
  LAB_TOUR,
  LAB_TOUR_MS,
  labImages,
  markerAt,
  opaqueHeight,
  nodeSpriteName,
  paperStopSprite,
  paperVariants,
  pathDots,
  poseAt,
  racePose,
  rulerTicks,
  stepMs,
  stopZoneId,
  tourAt,
  trailCookie,
} from '@features/chess-runner/utils/pack-lab.util';
import { MapZone } from '@features/chess-runner/models/pack.model';
import { normalizeMap, normalizePack, normalizeRunnerBackdrop } from '@features/chess-runner/utils/pack-manifest.util';

import { MAP_ZONA, PACK_VARIOS } from '@tests/support/pack-lab';

const [choco, , luna] = normalizePack(PACK_VARIOS);
const mapa = normalizeMap(MAP_ZONA);

describe('frameAt', () => {
  it('avanza un cuadro cada 1/fps segundos y vuelve a empezar', () => {
    expect([0, 83, 84, 250, 334].map((ms) => frameAt(ms, 12, 4))).toEqual([0, 0, 1, 3, 0]);
  });

  it('una tira de un cuadro o sin fps se queda en el 0', () => {
    expect(frameAt(5000, 12, 1)).toBe(0);
    expect(frameAt(5000, 0, 4)).toBe(0);
  });
});

describe('jumpPose', () => {
  it('despega, llega a la cima a mitad del salto y cae', () => {
    expect(jumpPose(0, 3)).toEqual({ frame: 0, lift: 0 });
    expect(jumpPose(LAB_JUMP_MS / 2, 3)).toEqual({ frame: 1, lift: LAB_JUMP_HEIGHT });
    expect(jumpPose(LAB_JUMP_MS - 1, 3)?.frame).toBe(2);
  });

  it('al terminar el salto ya está en el suelo', () => {
    expect(jumpPose(LAB_JUMP_MS, 3)).toBeNull();
  });
});

describe('tourAt (Recorrido)', () => {
  it('encadena las animaciones en orden y vuelve a empezar', () => {
    let inicio = 0;
    for (const [anim, ms] of LAB_TOUR) {
      expect(tourAt(inicio + 1).anim).toBe(anim);
      inicio += ms;
    }
    expect(tourAt(LAB_TOUR_MS + 1)).toEqual({ anim: LAB_TOUR[0][0], ms: 1 });
  });
});

describe('poseAt', () => {
  it('usa los fps de la animación pedida', () => {
    expect(poseAt('run', choco.animations, 84)).toEqual({ anim: 'run', frame: 1, lift: 0 });
  });

  it('el salto va por fases y se repite', () => {
    const cima = poseAt('jump', choco.animations, LAB_JUMP_MS / 2);
    expect(cima.frame).toBe(1);
    expect(cima.lift).toBe(LAB_JUMP_HEIGHT);
  });

  it('si al personaje le falta la animación, usa la primera que tenga', () => {
    expect(availableAnim('happy', luna.animations)).toBe('idle');
    expect(poseAt('happy', luna.animations, 0).anim).toBe('idle');
    expect(poseAt('run', {}, 0)).toEqual({ anim: null, frame: 0, lift: 0 });
  });

  it('el Recorrido elige la animación del momento', () => {
    const hurtAt = LAB_TOUR.slice(0, 3).reduce((t, [, ms]) => t + ms, 0) + 10;
    expect(poseAt('tour', choco.animations, hurtAt).anim).toBe('hurt');
  });
});

describe('racePose', () => {
  it('corre si no salta, y salta mientras dura el salto', () => {
    expect(racePose(choco.animations, 100, null).anim).toBe('run');
    expect(racePose(choco.animations, 100, LAB_JUMP_MS / 2)).toMatchObject({ anim: 'jump', lift: LAB_JUMP_HEIGHT });
    expect(racePose(choco.animations, 100, LAB_JUMP_MS + 1).anim).toBe('run');
  });

  it('quien no tiene salto sigue corriendo', () => {
    expect(racePose(luna.animations, 100, 10).anim).toBe('run');
  });
});

describe('stepMs', () => {
  it('es lo que dura un cuadro: 1/fps, o un tercio del salto', () => {
    expect(stepMs('run', choco.animations, 0)).toBeCloseTo(1000 / 12);
    expect(stepMs('jump', choco.animations, 0)).toBeCloseTo(LAB_JUMP_MS / 3);
  });
});

describe('rulerTicks', () => {
  it('marca cada 10 px hasta el alto pedido', () => {
    expect(rulerTicks(40)).toEqual([10, 20, 30, 40]);
    expect(rulerTicks(5)).toEqual([]);
  });
});

describe('nodeSpriteName', () => {
  it('busca el sprite del tipo y el estado', () => {
    expect(nodeSpriteName('pattern', 'open', mapa.sprites)).toBe('map-node-pattern-open');
    expect(nodeSpriteName('pattern', 'done2', mapa.sprites)).toBe('map-node-pattern-done2');
  });

  it('los tipos sin estrellas usan su «done» para done1-3', () => {
    expect(nodeSpriteName('camp', 'done3', mapa.sprites)).toBe('map-node-camp-done');
  });

  it('sin sprite, null (la pantalla pinta un respaldo)', () => {
    expect(nodeSpriteName('king', 'locked', mapa.sprites)).toBeNull();
  });
});

describe('pathDots', () => {
  it('pone puntitos entre cada par de puntos sin pisar los nodos', () => {
    const dots = pathDots([{ x: 0, y: 0, kind: 'a', order: 1 }, { x: 0, y: 44, kind: 'b', order: 2 }], 10, 12);

    expect(dots.map((d) => d.y)).toEqual([12, 22, 32]);
    expect(pathDots([{ x: 0, y: 0, kind: 'a', order: 1 }])).toEqual([]);
  });
});

describe('papel', () => {
  it('lista las variantes del papel que existan, en orden', () => {
    expect(paperVariants(mapa.sprites)).toEqual(['paper-map-d0', 'paper-map-d1']);
  });

  it('las galletas se llenan hasta el progreso y la última de cada zona es dorada', () => {
    const { trail } = mapa.paper;
    expect([0, 1, 2].map((i) => trailCookie(i, 0, trail, mapa.sprites))).toEqual(['cookie-board-empty', 'cookie-board-empty', 'cookie-board-empty']);
    expect([0, 1, 2].map((i) => trailCookie(i, 2, trail, mapa.sprites))).toEqual(['cookie-board', 'cookie-gold', 'cookie-board-empty']);
    expect(trailCookie(0, 1, trail, {})).toBeNull();
  });

  it('la huella va al último checkpoint alcanzado, o en la ruta antes de la primera parada sin tapar su cara', () => {
    const { trail, stops } = mapa.paper;
    const papel = { w: mapa.logical.paperW, h: mapa.logical.paperH };
    // parada (40, 280) y primer checkpoint (50, 270): 16 px hacia atrás en esa dirección
    expect(markerAt(0, trail, stops, papel)).toEqual({ x: 29, y: 291 });
    expect(markerAt(2, trail, stops, papel)).toEqual({ x: 60, y: 260 });
    expect(markerAt(99, trail, stops, papel)).toEqual({ x: 70, y: 250 });
    expect(markerAt(0, [], [], papel)).toBeNull();
  });

  it('con progreso 0 la huella no pisa la caja (20×20) de la primera parada del papel real', () => {
    const stop = { boss: 'ardilla', x: 40, y: 292 };
    const m = markerAt(0, [{ x: 59, y: 295, zone: '1' }], [stop], { w: 220, h: 320 });
    expect(m).toEqual({ x: 24, y: 290 });
    // la huella mide 12×12: su borde derecho queda en el borde izquierdo de la parada
    expect((m?.x ?? 99) + 6).toBeLessThanOrEqual(stop.x - 10);
  });

  it('la huella cae en la parada sin rastro y en el primer checkpoint sin paradas', () => {
    const papel = { w: 220, h: 320 };
    expect(markerAt(0, [], [{ boss: 'ardilla', x: 40, y: 280 }], papel)).toEqual({ x: 40, y: 280 });
    expect(markerAt(0, [{ x: 50, y: 270, zone: '1' }], [], papel)).toEqual({ x: 50, y: 270 });
  });

  it('la huella entera (12×12) queda dentro del papel por los cuatro lados', () => {
    const papel = { w: 220, h: 320 };
    // arriba a la izquierda: el centro iría a (-11, 5) y se queda a media huella del borde
    expect(markerAt(0, [{ x: 30, y: 5, zone: '1' }], [{ boss: 'ardilla', x: 5, y: 5 }], papel)).toEqual({ x: 6, y: 6 });
    // abajo a la derecha: iría a (231, 315)
    expect(markerAt(0, [{ x: 190, y: 315, zone: '1' }], [{ boss: 'ardilla', x: 215, y: 315 }], papel)).toEqual({ x: 214, y: 314 });
    // también un checkpoint pegado al borde
    expect(markerAt(1, [{ x: 220, y: 0, zone: '1' }], [], papel)).toEqual({ x: 214, y: 6 });
    // un papel más chico que la huella la deja en la esquina, sin coordenadas negativas
    expect(markerAt(1, [{ x: 3, y: 3, zone: '1' }], [], { w: 8, h: 8 })).toEqual({ x: 6, y: 6 });
  });

  it('el zoom del mapa baja al mayor entero que quepa a lo ancho (nunca menos de 1)', () => {
    expect(fitScale(2, 220, 357)).toBe(1);
    expect(fitScale(2, 220, 440)).toBe(2);
    expect(fitScale(4, 220, 700)).toBe(3);
    expect(fitScale(3, 220, 100)).toBe(1);
    expect(fitScale(2.4, 220, 0)).toBe(2);
  });

  it('con un zoom que no es un número finito el mapa queda a ×1', () => {
    expect(fitScale(NaN, 220, 440)).toBe(1);
    expect(fitScale(Infinity, 220, 0)).toBe(1);
    expect(fitScale(-Infinity, 220, 700)).toBe(1);
  });

  it('las paradas usan su cara abierta o la silueta cerrada', () => {
    expect(paperStopSprite('ardilla', true, mapa.sprites)).toBe('paper-stop-ardilla-open');
    expect(paperStopSprite('ardilla', false, mapa.sprites)).toBe('paper-stop-ardilla-locked');
    expect(paperStopSprite('rey', true, mapa.sprites)).toBeNull();
  });
});

describe('stopZoneId', () => {
  const zona = (id: string, boss: string | null): MapZone => ({ id, name: '', boss, darkness: 0, scene: null, points: [], ambient: [] });
  const paradas = ['ardilla', 'buho', 'zorro'].map((boss, i) => ({ boss, x: i, y: i }));

  it('une cada parada con la zona de su mismo jefe, aunque las zonas vengan sueltas', () => {
    const zonas = [zona('1', 'ardilla'), zona('2', 'buho'), zona('7', 'rey')];
    expect([0, 1, 2].map((i) => stopZoneId(paradas, i, zonas))).toEqual(['1', '2', '3']);
    expect(stopZoneId(paradas, 2, [zona('1', 'ardilla'), zona('5', 'zorro')])).toBe('5');
  });

  it('sin jefe que coincida usa su número de orden, no la posición en la lista de zonas', () => {
    expect(stopZoneId(paradas, 2, [zona('1', null), zona('7', null)])).toBe('3');
    expect(stopZoneId(paradas, 1, [])).toBe('2');
    expect(stopZoneId([], 0, [zona('1', 'ardilla')])).toBe('1');
  });
});

describe('labImages', () => {
  it('reúne tiras, retratos, sprites del mapa, ambientes y fondos sin repetir', () => {
    const imagenes = labImages({
      characters: [choco, luna],
      map: mapa,
      backdrop: normalizeRunnerBackdrop({ sprites: { 'scene-floor': { file: 'scene-floor.png', frameW: 32, frameH: 20, frames: 1 } } }),
    });
    const claves = imagenes.map((i) => `${i.folder}/${i.file}`);

    expect(claves).toContain('pack/pack-choco-portrait.png');
    expect(claves).toContain('pack/pack-choco-run.png');
    expect(claves).toContain('pack/pack-luna-idle.png');
    expect(claves).toContain('map/map-fx-1-hojas.png');
    expect(claves).toContain('runner/scene-floor.png');
    expect(new Set(claves).size).toBe(claves.length);
    expect(claves.filter((c) => c.startsWith('pack/'))).toHaveLength(1 + 5 + 2);
  });
});

describe('opaqueHeight', () => {
  it('cuenta de la primera a la última fila con algo opaco, con los huecos de en medio', () => {
    // 3×5: filas 1 y 3 opacas (la 2 vacía), alto visible 3
    expect(opaqueHeight([0, 0, 0, 0, 1, 0, 0, 0, 0, 255, 0, 0, 0, 0, 0], 3, 5)).toBe(3);
    expect(opaqueHeight([9, 9, 9, 9], 2, 2)).toBe(2);
  });

  it('un cuadro vacío mide 0', () => {
    expect(opaqueHeight(new Uint8ClampedArray(12), 3, 4)).toBe(0);
  });
});
