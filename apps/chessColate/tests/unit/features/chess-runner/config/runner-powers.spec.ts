import { CHAPTERS, POWER_IDS, RunnerPowerId } from '@features/chess-runner/campaign/runner-curriculum';
import { BASE_MODIFIERS, modifiersFor } from '@features/chess-runner/config/runner-powers';
import { COOKIES_PER_HEART, MAX_HEARTS, RUNNER_PHYSICS } from '@features/chess-runner/config/runner.config';

describe('los poderes del perrito', () => {
  it('sin poderes, las reglas son las de siempre', () => {
    expect(modifiersFor([])).toEqual(BASE_MODIFIERS);
    expect(BASE_MODIFIERS).toMatchObject({
      shields: 0,
      maxHearts: MAX_HEARTS,
      cookiesPerHeart: COOKIES_PER_HEART,
      stumbleTime: RUNNER_PHYSICS.stumbleTime,
      inputBuffer: RUNNER_PHYSICS.inputBuffer,
      doubleJumpVelocity: RUNNER_PHYSICS.doubleJumpVelocity,
      solveHeal: 1,
      tapCue: false,
      ghosts: false,
    });
  });

  it('todos los poderes del currículo hacen algo: cambian alguna regla', () => {
    for (const power of POWER_IDS) {
      expect(modifiersFor([power])).not.toEqual(BASE_MODIFIERS);
    }
  });

  it('cada poder cambia lo suyo y nada más', () => {
    const solo = (power: RunnerPowerId) => {
      const mods = modifiersFor([power]);
      return (Object.keys(mods) as (keyof typeof mods)[]).filter((key) => mods[key] !== BASE_MODIFIERS[key]);
    };

    expect(solo('nose').sort()).toEqual(['pickupReachX', 'pickupReachY']);
    expect(solo('spring')).toEqual(['doubleJumpVelocity']);
    expect(solo('shield')).toEqual(['shields']);
    expect(solo('trail')).toEqual(['tapCue']);
    expect(solo('ghost')).toEqual(['ghosts']);
    expect(solo('dodge')).toEqual(['stumbleTime']);
    expect(solo('heart')).toEqual(['maxHearts']);
    expect(solo('net')).toEqual(['cookiesPerHeart']);
    expect(solo('cloak')).toEqual(['inputBuffer']);
    expect(solo('crown')).toEqual(['solveHeal']);
  });

  it('los números: lo que dan', () => {
    expect(modifiersFor(['nose']).pickupReachX).toBeGreaterThan(BASE_MODIFIERS.pickupReachX + 5);
    expect(modifiersFor(['spring']).doubleJumpVelocity).toBeGreaterThan(RUNNER_PHYSICS.doubleJumpVelocity);
    expect(modifiersFor(['shield']).shields).toBe(1);
    expect(modifiersFor(['dodge']).stumbleTime).toBeCloseTo(RUNNER_PHYSICS.stumbleTime * 2, 5);
    expect(modifiersFor(['heart']).maxHearts).toBe(MAX_HEARTS + 1);
    expect(modifiersFor(['net']).cookiesPerHeart).toBeLessThan(COOKIES_PER_HEART);
    expect(modifiersFor(['net']).cookiesPerHeart).toBeGreaterThan(20);
    expect(modifiersFor(['cloak']).inputBuffer).toBeGreaterThan(RUNNER_PHYSICS.inputBuffer);
    expect(modifiersFor(['crown']).solveHeal).toBe(2);
  });

  it('se suman, y el orden da igual', () => {
    const todos = POWER_IDS.map((p) => p);
    const al_reves = [...todos].reverse();

    expect(modifiersFor(todos)).toEqual(modifiersFor(al_reves));
    expect(modifiersFor(['heart', 'shield'])).toMatchObject({ maxHearts: MAX_HEARTS + 1, shields: 1 });
  });

  it('un poder repetido (un dato guardado raro) no cuenta dos veces', () => {
    expect(modifiersFor(['shield', 'shield'])).toEqual(modifiersFor(['shield']));
  });

  it('con todos puestos el juego sigue siendo un reto: no se pierde ni se regala', () => {
    const mods = modifiersFor(CHAPTERS.flatMap((c) => (c.power ? [c.power] : [])));

    // Ayudas, no trampas: el doble salto sigue necesitando un segundo toque, sin escudos infinitos ni vidas de sobra
    expect(mods.shields).toBeLessThanOrEqual(1);
    expect(mods.maxHearts).toBeLessThanOrEqual(5);
    expect(mods.stumbleTime).toBeLessThan(2.5);
    expect(mods.inputBuffer).toBeLessThan(0.3);
    expect(mods.cookiesPerHeart).toBeGreaterThanOrEqual(30);
    expect(mods.solveHeal).toBeLessThanOrEqual(2);
  });
});
