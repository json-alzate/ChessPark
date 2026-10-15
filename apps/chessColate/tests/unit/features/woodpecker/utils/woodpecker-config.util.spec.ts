import {
  adjustEloRange,
  buildWoodpeckerConfig,
  clampCycles,
  defaultEloRange,
  estimateCycleMinutes,
  isWoodpeckerConfig,
  minCountFor,
  normalizeEloRange,
  resolveThemes,
  WoodpeckerSetupInput,
} from '@features/woodpecker/utils/woodpecker-config.util';
import { aleatorioConSemilla, configuracion } from '@tests/support/pajaro-carpintero';

describe('minCountFor', () => {
  it('acepta un set con el 70 % de lo pedido', () => {
    expect(minCountFor(100)).toBe(70);
    expect(minCountFor(500)).toBe(350);
  });

  it('redondea hacia arriba para no aceptar de menos', () => {
    expect(minCountFor(50)).toBe(35);
    expect(minCountFor(51)).toBe(36);
  });
});

describe('clampCycles', () => {
  it('deja pasar los valores válidos', () => {
    expect(clampCycles(5)).toBe(5);
  });

  it('sube a 2 vueltas como mínimo: con una sola no hay repetición', () => {
    expect(clampCycles(1)).toBe(2);
    expect(clampCycles(0)).toBe(2);
  });

  it('no pasa de 12 y redondea decimales', () => {
    expect(clampCycles(40)).toBe(12);
    expect(clampCycles(4.6)).toBe(5);
  });
});

describe('normalizeEloRange', () => {
  it('deja intacto un rango ya válido', () => {
    expect(normalizeEloRange(1300, 1700)).toEqual({ eloMin: 1300, eloMax: 1700 });
  });

  it('ajusta a pasos de 100', () => {
    expect(normalizeEloRange(1340, 1660)).toEqual({ eloMin: 1300, eloMax: 1700 });
  });

  it('acepta los extremos al revés', () => {
    expect(normalizeEloRange(1700, 1300)).toEqual({ eloMin: 1300, eloMax: 1700 });
  });

  it('exige 200 puntos de anchura moviendo el máximo', () => {
    expect(normalizeEloRange(1500, 1500)).toEqual({ eloMin: 1500, eloMax: 1700 });
    expect(normalizeEloRange(1500, 1600)).toEqual({ eloMin: 1500, eloMax: 1700 });
  });

  it('no se sale del catálogo (400 a 2800)', () => {
    expect(normalizeEloRange(100, 300)).toEqual({ eloMin: 400, eloMax: 600 });
    expect(normalizeEloRange(2700, 3500)).toEqual({ eloMin: 2600, eloMax: 2800 });
  });

  it('si no cabe por arriba, baja el mínimo en vez de salirse', () => {
    expect(normalizeEloRange(2800, 2800)).toEqual({ eloMin: 2600, eloMax: 2800 });
  });
});

describe('defaultEloRange', () => {
  it('abre una ventana de 200 puntos a cada lado del ELO', () => {
    expect(defaultEloRange(1500)).toEqual({ eloMin: 1300, eloMax: 1700 });
  });

  it('respeta el catálogo con un ELO muy bajo o muy alto', () => {
    expect(defaultEloRange(400)).toEqual({ eloMin: 400, eloMax: 600 });
    expect(defaultEloRange(2800)).toEqual({ eloMin: 2600, eloMax: 2800 });
  });
});

describe('resolveThemes', () => {
  const catalogo = ['fork', 'pin', 'skewer', 'mateIn2', 'endgame'];

  it('respeta los temas elegidos y su orden', () => {
    expect(resolveThemes(['pin', 'fork'], catalogo)).toEqual(['pin', 'fork']);
  });

  it('descarta los temas que no existen en el catálogo', () => {
    expect(resolveThemes(['fork', 'inventado'], catalogo)).toEqual(['fork']);
  });

  it('con «todos» sortea una mezcla sin repetir ninguno', () => {
    const muchos = Array.from({ length: 40 }, (_, i) => `tema${i}`);
    const temas = resolveThemes('all', muchos, aleatorioConSemilla(7));

    expect(temas).toHaveLength(10);
    expect(new Set(temas).size).toBe(10);
    temas.forEach((tema) => expect(muchos).toContain(tema));
  });

  it('con «todos» y pocos temas disponibles usa los que haya', () => {
    expect(resolveThemes('all', catalogo, aleatorioConSemilla(3)).sort()).toEqual(
      [...catalogo].sort()
    );
  });

  it('el sorteo cambia con la semilla (no es siempre el mismo)', () => {
    const muchos = Array.from({ length: 40 }, (_, i) => `tema${i}`);
    expect(resolveThemes('all', muchos, aleatorioConSemilla(1))).not.toEqual(
      resolveThemes('all', muchos, aleatorioConSemilla(99))
    );
  });
});

describe('buildWoodpeckerConfig', () => {
  const entrada: WoodpeckerSetupInput = {
    size: 200,
    eloMin: 1340,
    eloMax: 1660,
    themes: ['fork', 'pin'],
    cycles: 7,
    order: 'shuffle',
    pace: 'standard',
  };

  it('traduce lo elegido a la configuración que se guarda', () => {
    expect(buildWoodpeckerConfig(entrada, ['fork', 'pin', 'skewer'])).toEqual({
      targetCount: 200,
      minCount: 140,
      eloMin: 1300,
      eloMax: 1700,
      themes: ['fork', 'pin'],
      cycles: 7,
      order: 'shuffle',
      timing: 'decreasing',
      baseTimePerPuzzleSec: 60,
      decreasePercent: 20,
    });
  });

  it('el ritmo relajado no pone reloj', () => {
    const config = buildWoodpeckerConfig({ ...entrada, pace: 'relaxed' }, ['fork', 'pin']);
    expect(config.timing).toBe('none');
  });

  it('el ritmo intenso arranca con menos tiempo que el estándar', () => {
    const estandar = buildWoodpeckerConfig({ ...entrada, pace: 'standard' }, ['fork', 'pin']);
    const intenso = buildWoodpeckerConfig({ ...entrada, pace: 'intense' }, ['fork', 'pin']);
    expect(intenso.baseTimePerPuzzleSec).toBeLessThan(estandar.baseTimePerPuzzleSec);
  });

  it('guarda los temas sorteados cuando se eligió «todos»', () => {
    const muchos = Array.from({ length: 30 }, (_, i) => `tema${i}`);
    const config = buildWoodpeckerConfig(
      { ...entrada, themes: 'all' },
      muchos,
      aleatorioConSemilla(5)
    );
    expect(config.themes).toHaveLength(10);
  });

  it('corrige vueltas fuera de rango', () => {
    expect(buildWoodpeckerConfig({ ...entrada, cycles: 99 }, ['fork']).cycles).toBe(12);
  });
});

describe('isWoodpeckerConfig', () => {
  it('reconoce una configuración completa', () => {
    expect(isWoodpeckerConfig(configuracion())).toBe(true);
  });

  it('rechaza lo que no es un objeto o está incompleto', () => {
    expect(isWoodpeckerConfig(null)).toBe(false);
    expect(isWoodpeckerConfig('texto')).toBe(false);
    expect(isWoodpeckerConfig({ targetCount: 100 })).toBe(false);
  });

  it('rechaza un orden o un tiempo desconocidos', () => {
    expect(isWoodpeckerConfig({ ...configuracion(), order: 'raro' })).toBe(false);
    expect(isWoodpeckerConfig({ ...configuracion(), timing: 'raro' })).toBe(false);
  });

  it('rechaza una configuración sin vueltas', () => {
    expect(isWoodpeckerConfig({ ...configuracion(), cycles: 0 })).toBe(false);
  });
});

describe('estimateCycleMinutes', () => {
  it('estima unos 25 segundos por ejercicio, de 5 en 5 minutos', () => {
    expect(estimateCycleMinutes(100)).toBe(40);
    expect(estimateCycleMinutes(200)).toBe(85);
    expect(estimateCycleMinutes(500)).toBe(210);
  });

  it('un set pequeño nunca baja de 5 minutos', () => {
    expect(estimateCycleMinutes(10)).toBe(5);
  });

  it('crece con el tamaño del set', () => {
    expect(estimateCycleMinutes(300)).toBeGreaterThan(estimateCycleMinutes(100));
  });
});

describe('adjustEloRange', () => {
  const rango = { eloMin: 1300, eloMax: 1700 };

  it('mover el mínimo dentro de lo permitido no toca el máximo', () => {
    expect(adjustEloRange(rango, 'min', 1100)).toEqual({ eloMin: 1100, eloMax: 1700 });
  });

  it('subir el mínimo hasta el máximo empuja el máximo para dejar 200 puntos', () => {
    expect(adjustEloRange(rango, 'min', 1600)).toEqual({ eloMin: 1600, eloMax: 1800 });
    expect(adjustEloRange(rango, 'min', 2000)).toEqual({ eloMin: 2000, eloMax: 2200 });
  });

  it('bajar el máximo hasta el mínimo empuja el mínimo hacia abajo', () => {
    expect(adjustEloRange(rango, 'max', 1400)).toEqual({ eloMin: 1200, eloMax: 1400 });
  });

  it('mover el máximo dentro de lo permitido no toca el mínimo', () => {
    expect(adjustEloRange(rango, 'max', 2000)).toEqual({ eloMin: 1300, eloMax: 2000 });
  });

  it('no se sale del catálogo por los extremos', () => {
    expect(adjustEloRange(rango, 'min', 100)).toEqual({ eloMin: 400, eloMax: 1700 });
    expect(adjustEloRange(rango, 'min', 3000)).toEqual({ eloMin: 2600, eloMax: 2800 });
    expect(adjustEloRange(rango, 'max', 3000)).toEqual({ eloMin: 1300, eloMax: 2800 });
    expect(adjustEloRange(rango, 'max', 100)).toEqual({ eloMin: 400, eloMax: 600 });
  });

  it('ajusta a pasos de 100', () => {
    expect(adjustEloRange(rango, 'min', 1140)).toEqual({ eloMin: 1100, eloMax: 1700 });
  });
});
