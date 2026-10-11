import {
  minutesFromBlocks,
  routineMetaFromPlanType,
  screenNameFromUrl,
} from '@services/analytics/analytics-events.util';

describe('routineMetaFromPlanType', () => {
  it.each([
    ['infinity', 'Infinita'],
    ['reto333', 'Reto 333'],
    ['streak', 'Racha'],
    ['custom', 'Personalizada'],
    ['public', 'Pública'],
  ])('el tipo especial %s se resuelve con su nombre y sin minutos', (planType, name) => {
    expect(routineMetaFromPlanType(planType)).toEqual({
      kind: planType,
      minutes: 0,
      category: '',
      name,
    });
  });

  it.each([
    ['plan1', 1, 'bullet'],
    ['plan3', 3, 'blitz'],
    ['plan5', 5, 'blitz'],
    ['plan10', 10, 'rapid'],
    ['plan20', 20, 'rapid'],
    ['plan30', 30, 'classical'],
  ])('%s son %i minutos y categoría %s', (planType, minutes, category) => {
    expect(routineMetaFromPlanType(planType)).toEqual({
      kind: 'default',
      minutes,
      category,
      name: `Rutina ${minutes} min`,
    });
  });

  it('un plan por defecto con minutos sin categoría conocida deja la categoría vacía', () => {
    const meta = routineMetaFromPlanType('plan7');

    expect(meta.kind).toBe('default');
    expect(meta.minutes).toBe(7);
    expect(meta.category).toBe('');
  });

  it('un tipo desconocido sin número conserva el texto como nombre y 0 minutos', () => {
    expect(routineMetaFromPlanType('warmup')).toEqual({
      kind: 'default',
      minutes: 0,
      category: '',
      name: 'warmup',
    });
  });
});

describe('minutesFromBlocks', () => {
  it('devuelve 0 sin bloques o con la lista vacía', () => {
    expect(minutesFromBlocks(undefined)).toBe(0);
    expect(minutesFromBlocks([])).toBe(0);
  });

  it('suma los segundos de los bloques y los pasa a minutos', () => {
    expect(minutesFromBlocks([{ time: 60 }, { time: 120 }, { time: 180 }])).toBe(6);
  });

  it('redondea al minuto más cercano', () => {
    expect(minutesFromBlocks([{ time: 89 }])).toBe(1);
    expect(minutesFromBlocks([{ time: 91 }])).toBe(2);
  });

  it('ignora bloques sin tiempo o con tiempo negativo o cero', () => {
    expect(minutesFromBlocks([{ time: 120 }, {}, { time: -500 }, { time: 0 }])).toBe(2);
  });
});

describe('screenNameFromUrl', () => {
  it('traduce las rutas conocidas', () => {
    expect(screenNameFromUrl('/home')).toBe('Inicio');
    expect(screenNameFromUrl('/puzzles/training')).toBe('Entrenamiento');
    expect(screenNameFromUrl('/settings')).toBe('Ajustes');
  });

  it('ignora query y hash', () => {
    expect(screenNameFromUrl('/streak?x=1')).toBe('Racha');
    expect(screenNameFromUrl('/streak#top')).toBe('Racha');
    expect(screenNameFromUrl('/analytics?a=1#b')).toBe('Análisis de partidas');
  });

  it('resuelve la ruta dinámica de editar rutina', () => {
    expect(screenNameFromUrl('/puzzles/custom-plans/edit/abc123')).toBe('Editar rutina');
  });

  it('una ruta bajo /games/ desconocida es una colección de partidas, pero /games/viewer sigue siendo el reproductor', () => {
    expect(screenNameFromUrl('/games/lichess-top')).toBe('Colección de partidas');
    expect(screenNameFromUrl('/games/viewer')).toBe('Reproductor de partidas');
  });

  it('la raíz y la cadena vacía son Inicio', () => {
    expect(screenNameFromUrl('/')).toBe('Inicio');
    expect(screenNameFromUrl('')).toBe('Inicio');
  });

  it('devuelve la ruta cruda si no la conoce', () => {
    expect(screenNameFromUrl('/ruta/rara')).toBe('/ruta/rara');
  });
});
