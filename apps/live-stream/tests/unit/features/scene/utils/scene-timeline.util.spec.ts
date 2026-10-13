import { CLOUDS, CYCLE_S, cloudX, nightAt, sceneAt } from '@features/scene/utils/scene-timeline.util';

const at = (seconds: number) => sceneAt(seconds * 1000);

describe('sceneAt', () => {
  it('es una función del tiempo: el mismo instante da la misma escena', () => {
    expect(at(30)).toEqual(at(30));
  });

  it('se repite cada ciclo, así un reinicio del runner retoma donde toca', () => {
    expect(sceneAt(30_000 + CYCLE_S * 1000).dog).toEqual(sceneAt(30_000).dog);
  });

  it('el gato aparece solo durante su ventana y Chocolate le ladra mientras está', () => {
    expect(at(10).cat.visible).toBe(false);
    expect(at(30).cat.visible).toBe(true);
    expect(at(30).dog.sprite).toBe('dog-bark');
    expect(at(45).cat.visible).toBe(false);
  });

  it('el hueso llega con la mano y se retira después', () => {
    expect(at(64).hand.visible).toBe(true);
    expect(at(67).bone.visible).toBe(true);
    expect(at(80).bone.visible).toBe(false);
  });

  it('el hoyo aparece al cavar, se va cerrando y desaparece', () => {
    expect(at(40).hole.visible).toBe(false);
    expect(at(55)).toMatchObject({ hole: { visible: true, sprite: 'hole-open' } });
    expect(at(85).hole.sprite).toBe('hole-half');
    expect(at(89).hole.sprite).toBe('hole-mound');
    expect(at(93).hole.visible).toBe(false);
  });

  it('Chocolate siempre tiene un tramo del guion, en todo el ciclo', () => {
    for (let t = 0; t < CYCLE_S; t += 0.5) {
      expect(at(t).dog.sprite).toMatch(/^dog-/);
    }
  });

  it('en una carrera interpola la posición entre los extremos', () => {
    const start = at(64).dog.x;
    const mid = at(66.5).dog.x;
    expect(mid).toBeLessThan(start);
    expect(mid).toBeGreaterThan(130);
  });
});

describe('nightAt', () => {
  const DAY = 60_000;

  it('es de día al empezar y de noche más allá de la mitad', () => {
    expect(nightAt(0.2 * DAY, DAY)).toBe(0);
    expect(nightAt(0.7 * DAY, DAY)).toBe(1);
  });

  it('el atardecer y el amanecer son transiciones, no saltos', () => {
    const dusk = nightAt(0.48 * DAY, DAY);
    expect(dusk).toBeGreaterThan(0);
    expect(dusk).toBeLessThan(1);
    const dawn = nightAt(0.95 * DAY, DAY);
    expect(dawn).toBeGreaterThan(0);
    expect(dawn).toBeLessThan(1);
  });
});

describe('cloudX', () => {
  const def = CLOUDS[0];

  it('avanza hacia la derecha y da la vuelta por el otro lado', () => {
    const a = cloudX(def, 0, 960, 92);
    const b = cloudX(def, 10_000, 960, 92);
    expect(b).toBeGreaterThan(a);
    const wrapped = cloudX(def, 1_000_000_000, 960, 92);
    expect(wrapped).toBeGreaterThanOrEqual(-92);
    expect(wrapped).toBeLessThan(960 + 92);
  });
});
