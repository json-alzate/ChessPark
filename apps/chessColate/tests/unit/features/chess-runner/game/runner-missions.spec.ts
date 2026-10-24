import {
  Mission,
  MISSION_REWARD_SECONDS,
  missionDone,
  missionFailed,
  missionFor,
  MissionProgress,
  missionValue,
} from '@features/chess-runner/game/runner-missions';

const nada: MissionProgress = { perfects: 0, cookies: 0, bestCombo: 0, stars: 0, stumbles: 0 };

describe('la misión de cada carrera', () => {
  it('es siempre la misma para el mismo ejercicio y nivel', () => {
    expect(missionFor('abc', 4)).toEqual(missionFor('abc', 4));
  });

  it('al empezar solo salen las fáciles; la racha desde el nivel 3 y «sin choques» desde el 5', () => {
    const tipos = (nivel: number) => new Set(Array.from({ length: 200 }, (_, i) => missionFor(`ej-${i}`, nivel).kind));

    expect(tipos(1)).toEqual(new Set(['cookies', 'perfects', 'star']));
    expect(tipos(3)).toEqual(new Set(['cookies', 'perfects', 'star', 'combo']));
    expect(tipos(5)).toEqual(new Set(['cookies', 'perfects', 'star', 'combo', 'clean']));
  });

  it('todos los tipos salen con una frecuencia razonable, no siempre el mismo', () => {
    const cuenta: Record<string, number> = {};
    for (let i = 0; i < 500; i++) {
      const { kind } = missionFor(`ej-${i}`, 8);
      cuenta[kind] = (cuenta[kind] ?? 0) + 1;
    }

    for (const n of Object.values(cuenta)) {
      expect(n).toBeGreaterThan(50);
    }
  });

  it('los objetivos suben con el nivel, con un tope', () => {
    const objetivo = (tipo: Mission['kind'], nivel: number) => {
      for (let i = 0; i < 2000; i++) {
        const m = missionFor(`x-${i}`, nivel);
        if (m.kind === tipo) return m.target;
      }
      throw new Error('no salió');
    };

    expect(objetivo('cookies', 20)).toBeGreaterThan(objetivo('cookies', 1));
    expect(objetivo('perfects', 20)).toBeGreaterThan(objetivo('perfects', 1));
    expect(objetivo('combo', 20)).toBeGreaterThan(objetivo('combo', 3));
    expect(objetivo('cookies', 999)).toBeLessThanOrEqual(80);
    expect(objetivo('perfects', 999)).toBeLessThanOrEqual(5);
    expect(objetivo('combo', 999)).toBeLessThanOrEqual(12);
    expect(objetivo('star', 10)).toBe(1);
  });

  it('el premio es tiempo para el ejercicio', () => {
    expect(missionFor('a', 1).reward).toBe(MISSION_REWARD_SECONDS);
    expect(MISSION_REWARD_SECONDS).toBeGreaterThan(0);
  });

  it('niveles raros (cero, negativos, con decimales) no rompen', () => {
    for (const nivel of [0, -4, 2.7, NaN]) {
      expect(() => missionFor('a', nivel)).not.toThrow();
    }
  });

  describe('cómo va y cuándo se cumple', () => {
    const m = (kind: Mission['kind'], target: number): Mission => ({ kind, target, reward: 10 });

    it('perfectos, galletas y racha cuentan hasta el objetivo y se cumplen al llegar', () => {
      expect(missionValue(m('perfects', 3), { ...nada, perfects: 2 })).toBe(2);
      expect(missionDone(m('perfects', 3), { ...nada, perfects: 2 })).toBe(false);
      expect(missionDone(m('perfects', 3), { ...nada, perfects: 3 })).toBe(true);
      expect(missionValue(m('perfects', 3), { ...nada, perfects: 9 })).toBe(3);

      expect(missionDone(m('cookies', 30), { ...nada, cookies: 31 })).toBe(true);
      expect(missionDone(m('combo', 8), { ...nada, bestCombo: 7 })).toBe(false);
      expect(missionDone(m('combo', 8), { ...nada, bestCombo: 8 })).toBe(true);
    });

    it('la estrella se cumple al cogerla', () => {
      expect(missionDone(m('star', 1), nada)).toBe(false);
      expect(missionDone(m('star', 1), { ...nada, stars: 1 })).toBe(true);
      expect(missionValue(m('star', 1), { ...nada, stars: 3 })).toBe(1);
    });

    it('«sin choques» solo se cumple al acabar la carrera sin chocar, y se pierde con el primer choque', () => {
      expect(missionDone(m('clean', 1), nada)).toBe(false);
      expect(missionDone(m('clean', 1), nada, true)).toBe(true);
      expect(missionDone(m('clean', 1), { ...nada, stumbles: 1 }, true)).toBe(false);
      expect(missionFailed(m('clean', 1), nada)).toBe(false);
      expect(missionFailed(m('clean', 1), { ...nada, stumbles: 1 })).toBe(true);
      expect(missionValue(m('clean', 1), { ...nada, stumbles: 2 })).toBe(0);
      // Las demás no se pierden por chocar
      expect(missionFailed(m('perfects', 3), { ...nada, stumbles: 5 })).toBe(false);
    });
  });
});
