import { CampaignEvent, RunnerCampaign } from '@features/chess-runner/campaign/runner-campaign.model';
import {
  activeDayStreak,
  applyResult,
  currentStep,
  dayKey,
  depthOf,
  hasSeen,
  learnedThemes,
  markSeen,
  newCampaign,
  ratingAfter,
  sanitizeCampaign,
  startingRating,
  starsForFails,
  touchDay,
  weakestPattern,
} from '@features/chess-runner/campaign/runner-campaign.util';
import {
  BLOCK_ELO_OFFSETS,
  BLOCK_SIZE,
  CHAPTERS,
  FAIL_ELO_EASING,
  MAX_RATING,
  POWER_IDS,
  REVIEW_ELO_OFFSET,
  REVIEW_SIZE,
  worldOfChapter,
  WORLDS,
} from '@features/chess-runner/campaign/runner-curriculum';

/** Juega una serie de resultados (true = acierta) y devuelve la campaña y todo lo que pasó. */
function jugar(inicial: RunnerCampaign, resultados: boolean[]) {
  let campaign = inicial;
  const eventos: CampaignEvent[] = [];
  for (const resultado of resultados) {
    const paso = applyResult(campaign, resultado);
    campaign = paso.campaign;
    eventos.push(...paso.events);
  }
  return { campaign, eventos };
}

const aciertos = (n: number) => Array<boolean>(n).fill(true);

/** Una campaña que ya terminó los `n` primeros capítulos, sin repaso pendiente. */
function conCapitulos(n: number): RunnerCampaign {
  let campaign = newCampaign();
  for (let i = 0; i < n; i++) {
    campaign = { ...jugar(campaign, aciertos(BLOCK_SIZE)).campaign, review: null };
  }
  return campaign;
}

describe('el currículo', () => {
  const conPoder = CHAPTERS.flatMap((c) => (c.power ? [c.power] : []));

  it('son veinte capítulos con un patrón y un mundo cada uno, sin repetirse', () => {
    expect(CHAPTERS).toHaveLength(20);
    expect(new Set(CHAPTERS.map((c) => c.theme)).size).toBe(CHAPTERS.length);
    for (const capitulo of CHAPTERS) {
      expect(WORLDS).toContain(capitulo.world);
    }
  });

  it('los poderes llegan cada dos capítulos, todos distintos, y el último capítulo da el último', () => {
    expect(new Set(conPoder).size).toBe(conPoder.length);
    expect(conPoder).toHaveLength(POWER_IDS.length);
    expect(CHAPTERS.map((c, i) => (c.power ? i : -1)).filter((i) => i >= 0)).toEqual([1, 3, 5, 7, 9, 11, 13, 15, 17, 19]);
    expect(CHAPTERS[CHAPTERS.length - 1].power).toBe('crown');
  });

  it('todos los poderes se ganan con algún capítulo', () => {
    expect([...conPoder].sort()).toEqual([...POWER_IDS].sort());
  });

  it('los mundos avanzan de día a tormenta, sin saltos atrás', () => {
    const indices = CHAPTERS.map((c) => WORLDS.indexOf(c.world));
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
    expect(new Set(indices).size).toBe(WORLDS.length);
    expect(worldOfChapter(0)).toBe('day');
    expect(worldOfChapter(CHAPTERS.length - 1)).toBe('storm');
    // Pasado el último, se queda en la tormenta
    expect(worldOfChapter(CHAPTERS.length + 5)).toBe('storm');
    expect(worldOfChapter(-3)).toBe('day');
  });

  it('el ELO sube dentro del bloque: empieza por debajo del usuario y acaba por encima', () => {
    expect(BLOCK_ELO_OFFSETS).toHaveLength(BLOCK_SIZE);
    expect(BLOCK_ELO_OFFSETS[0]).toBeLessThan(0);
    expect(BLOCK_ELO_OFFSETS[BLOCK_SIZE - 1]).toBeGreaterThan(0);
    expect([...BLOCK_ELO_OFFSETS]).toEqual([...BLOCK_ELO_OFFSETS].sort((a, b) => a - b));
  });
});

describe('qué toca jugar', () => {
  it('al empezar, el primer patrón del currículo, con un ejercicio suave', () => {
    const paso = currentStep(newCampaign());

    expect(paso).toEqual({
      kind: 'block',
      chapter: 0,
      theme: CHAPTERS[0].theme,
      index: 0,
      total: BLOCK_SIZE,
      eloOffset: BLOCK_ELO_OFFSETS[0],
    });
  });

  it('todos los ejercicios de un capítulo son del mismo patrón: el tema no cambia de uno a otro', () => {
    let campaign = newCampaign();
    const temas = new Set<string>();
    for (let i = 0; i < BLOCK_SIZE; i++) {
      temas.add(currentStep(campaign).theme);
      campaign = applyResult(campaign, true).campaign;
    }

    expect([...temas]).toEqual([CHAPTERS[0].theme]);
  });

  it('también al fallar: el siguiente sigue siendo del mismo patrón', () => {
    const { campaign } = jugar(newCampaign(), [false, false, true, false]);

    expect(currentStep(campaign).theme).toBe(CHAPTERS[0].theme);
    expect(currentStep(campaign).chapter).toBe(0);
  });

  it('resolver avanza el puesto del bloque y sube la dificultad', () => {
    const offsets: number[] = [];
    let campaign = newCampaign();
    for (let i = 0; i < BLOCK_SIZE; i++) {
      offsets.push(currentStep(campaign).eloOffset);
      campaign = applyResult(campaign, true).campaign;
    }

    expect(offsets).toEqual([...BLOCK_ELO_OFFSETS]);
  });

  it('fallar no avanza, apunta el fallo y hace el siguiente más fácil (hasta un tope)', () => {
    const base = currentStep(newCampaign()).eloOffset;
    let campaign = newCampaign();

    campaign = applyResult(campaign, false).campaign;
    expect(campaign.solvedInBlock).toBe(0);
    expect(campaign.failsInBlock).toBe(1);
    expect(currentStep(campaign).eloOffset).toBe(base - FAIL_ELO_EASING);

    campaign = applyResult(campaign, false).campaign;
    expect(currentStep(campaign).eloOffset).toBe(base - 2 * FAIL_ELO_EASING);

    campaign = applyResult(campaign, false).campaign;
    expect(currentStep(campaign).eloOffset).toBe(base - 2 * FAIL_ELO_EASING);
    expect(campaign.failsInBlock).toBe(3);
  });

  it('no muta la campaña que recibe', () => {
    const original = newCampaign();
    const copia = JSON.parse(JSON.stringify(original));

    applyResult(original, true);

    expect(original).toEqual(copia);
  });
});

describe('las estadísticas de cada patrón', () => {
  it('cuentan lo acertado, lo fallado y cuándo se vio por última vez', () => {
    const { campaign } = jugar(newCampaign(), [true, false, true]);

    expect(campaign.mastery[CHAPTERS[0].theme]).toEqual({ solved: 2, failed: 1, lastSeen: 3 });
    expect(campaign.puzzles).toBe(3);
  });
});

describe('terminar un capítulo', () => {
  it('con cinco aciertos seguidos: tres estrellas y el siguiente capítulo (el primero no da poder)', () => {
    const { campaign, eventos } = jugar(newCampaign(), aciertos(BLOCK_SIZE));

    expect(eventos).toEqual([{ kind: 'chapterComplete', chapter: 0, stars: 3, power: null, firstTime: false }]);
    expect(campaign.chapter).toBe(1);
    expect(campaign.solvedInBlock).toBe(0);
    expect(campaign.failsInBlock).toBe(0);
    expect(campaign.powers).toEqual([]);
    expect(campaign.stars).toEqual([3]);
    expect(currentStep(campaign).theme).toBe(CHAPTERS[1].theme);
  });

  it('el segundo capítulo sí da su poder, una sola vez', () => {
    const { campaign, eventos } = jugar(conCapitulos(1), aciertos(BLOCK_SIZE));

    expect(eventos[0]).toEqual({ kind: 'chapterComplete', chapter: 1, stars: 3, power: CHAPTERS[1].power, firstTime: true });
    expect(campaign.powers).toEqual([CHAPTERS[1].power]);
  });

  it('las estrellas bajan con los fallos', () => {
    expect(starsForFails(0)).toBe(3);
    expect(starsForFails(1)).toBe(2);
    expect(starsForFails(2)).toBe(1);
    expect(starsForFails(9)).toBe(1);

    const unFallo = jugar(newCampaign(), [false, ...aciertos(BLOCK_SIZE)]);
    expect(unFallo.campaign.stars).toEqual([2]);
    const muchos = jugar(newCampaign(), [false, false, false, ...aciertos(BLOCK_SIZE)]);
    expect(muchos.campaign.stars).toEqual([1]);
  });

  it('el capítulo se cierra con el quinto acierto, no con el quinto ejercicio: fallar alarga el bloque', () => {
    const { campaign, eventos } = jugar(newCampaign(), [true, true, false, true, true]);

    expect(campaign.chapter).toBe(0);
    expect(campaign.solvedInBlock).toBe(4);
    expect(eventos).toEqual([]);
  });

  it('tras el primer capítulo no hay nada que repasar todavía', () => {
    const { campaign } = jugar(newCampaign(), aciertos(BLOCK_SIZE));

    expect(campaign.review).toBeNull();
  });

  it('tras el segundo, hay un repaso del patrón anterior antes del capítulo nuevo', () => {
    const { campaign, eventos } = jugar(conCapitulos(1), aciertos(BLOCK_SIZE));

    expect(eventos).toContainEqual({ kind: 'reviewStart', theme: CHAPTERS[0].theme });
    expect(campaign.review).toEqual({ theme: CHAPTERS[0].theme, left: REVIEW_SIZE });
    expect(currentStep(campaign)).toMatchObject({ kind: 'review', theme: CHAPTERS[0].theme, index: 0, total: REVIEW_SIZE, eloOffset: REVIEW_ELO_OFFSET });
  });
});

describe('el repaso', () => {
  const conRepaso = () => jugar(conCapitulos(1), aciertos(BLOCK_SIZE)).campaign;

  it('resolver avanza el repaso; al acabar, vuelve el capítulo en curso', () => {
    let campaign = conRepaso();
    let paso = applyResult(campaign, true);
    expect(currentStep(paso.campaign)).toMatchObject({ kind: 'review', index: 1 });

    paso = applyResult(paso.campaign, true);
    campaign = paso.campaign;

    expect(paso.events).toEqual([{ kind: 'reviewDone' }]);
    expect(campaign.review).toBeNull();
    expect(currentStep(campaign)).toMatchObject({ kind: 'block', chapter: 2, theme: CHAPTERS[2].theme });
  });

  it('fallar no lo avanza, pero cuenta en lo que se domina del patrón', () => {
    const campaign = conRepaso();
    const antes = campaign.mastery[CHAPTERS[0].theme];

    const { campaign: despues } = applyResult(campaign, false);

    expect(despues.review).toEqual(campaign.review);
    expect(despues.mastery[CHAPTERS[0].theme].failed).toBe(antes.failed + 1);
    // Y no toca el progreso del bloque del capítulo
    expect(despues.failsInBlock).toBe(0);
  });

  it('repasa el patrón que peor se tiene, no siempre el último', () => {
    let campaign = conCapitulos(2);
    // Mucho fallo en el primer patrón, ninguno en el segundo
    campaign = {
      ...campaign,
      mastery: {
        ...campaign.mastery,
        [CHAPTERS[0].theme]: { solved: 1, failed: 6, lastSeen: campaign.puzzles },
        [CHAPTERS[1].theme]: { solved: 6, failed: 0, lastSeen: campaign.puzzles },
      },
    };

    expect(weakestPattern(campaign)).toBe(CHAPTERS[0].theme);
    const { campaign: tras } = jugar(campaign, aciertos(BLOCK_SIZE));
    expect(tras.review?.theme).toBe(CHAPTERS[0].theme);
  });

  it('a igualdad de fallos repasa el que hace más que no se ve', () => {
    let campaign = conCapitulos(2);
    campaign = {
      ...campaign,
      puzzles: 100,
      mastery: {
        [CHAPTERS[0].theme]: { solved: 5, failed: 0, lastSeen: 10 },
        [CHAPTERS[1].theme]: { solved: 5, failed: 0, lastSeen: 95 },
      },
    };

    expect(weakestPattern(campaign)).toBe(CHAPTERS[0].theme);
  });

  it('weakestPattern: sin nada aprendido no hay qué repasar, y puede dejar fuera uno', () => {
    expect(weakestPattern(newCampaign())).toBeNull();
    expect(weakestPattern(conCapitulos(1), CHAPTERS[0].theme)).toBeNull();
    expect(learnedThemes(conCapitulos(2))).toEqual([CHAPTERS[0].theme, CHAPTERS[1].theme]);
  });

  it('un patrón que nunca se ha visto cuenta como medio dominado (ni el mejor ni el peor)', () => {
    const campaign = conCapitulos(2);
    const sinDatos = { ...campaign, mastery: {} };

    expect(weakestPattern(sinDatos)).toBe(CHAPTERS[0].theme);
  });
});

describe('terminar una ronda', () => {
  it('al cerrar el último capítulo avisa y empieza otra ronda con los mismos patrones', () => {
    const { campaign, eventos } = jugar(conCapitulos(CHAPTERS.length - 1), aciertos(BLOCK_SIZE));

    expect(eventos.map((e) => e.kind)).toEqual(['chapterComplete', 'roundComplete', 'reviewStart']);
    expect(eventos).toContainEqual({ kind: 'roundComplete', round: 0 });
    expect(campaign.round).toBe(1);
    expect(campaign.chapter).toBe(0);
    expect(campaign.powers).toHaveLength(POWER_IDS.length);
    expect(campaign.stars).toEqual([]);
    // Antes del primer capítulo de la ronda nueva, un repaso del patrón más flojo de todos
    expect(campaign.review).not.toBeNull();
  });

  it('en la ronda nueva se repasa cualquiera de los veinte y el nivel sigue creciendo', () => {
    const { campaign } = jugar(conCapitulos(CHAPTERS.length - 1), aciertos(BLOCK_SIZE));

    expect(learnedThemes(campaign)).toEqual(CHAPTERS.map((c) => c.theme));
    expect(depthOf(campaign)).toBe(CHAPTERS.length);
    expect(depthOf(newCampaign())).toBe(0);
  });

  it('se puede jugar ronda tras ronda: nunca hay final y siempre toca un ejercicio de un patrón', () => {
    let campaign = newCampaign();
    for (let i = 0; i < CHAPTERS.length * (BLOCK_SIZE + REVIEW_SIZE) * 2 + 20; i++) {
      const paso = currentStep(campaign);
      expect(CHAPTERS.map((c) => c.theme)).toContain(paso.theme);
      campaign = applyResult(campaign, true).campaign;
    }

    expect(campaign.round).toBeGreaterThanOrEqual(2);
  });
});

describe('el ELO del perrito', () => {
  const conElo = (rating: number): RunnerCampaign => ({ ...newCampaign(), rating, peakRating: rating });

  it('empieza algo por debajo del ELO del usuario, dentro de unos límites', () => {
    expect(startingRating(1200)).toBe(900);
    expect(startingRating(400)).toBe(600);
    expect(startingRating(2800)).toBe(1500);
    expect(startingRating(NaN)).toBe(900);
  });

  it('resolver sube el ELO, y más cuanto más difícil era el ejercicio', () => {
    expect(ratingAfter(1000, 1000, true, 100)).toBe(1012);
    expect(ratingAfter(1000, 1300, true, 100)).toBeGreaterThan(ratingAfter(1000, 1000, true, 100));
    expect(ratingAfter(1000, 700, true, 100)).toBeLessThan(ratingAfter(1000, 1000, true, 100));
  });

  it('fallar lo baja, y más cuanto más fácil era el ejercicio', () => {
    expect(ratingAfter(1000, 1000, false, 100)).toBe(988);
    expect(ratingAfter(1000, 700, false, 100)).toBeLessThan(ratingAfter(1000, 1300, false, 100));
  });

  it('al principio se mueve más (factor K alto), para que se note el avance', () => {
    expect(ratingAfter(1000, 1000, true, 0) - 1000).toBeGreaterThan(ratingAfter(1000, 1000, true, 200) - 1000);
  });

  it('tiene suelo y techo', () => {
    expect(ratingAfter(100, 3000, false, 0)).toBeGreaterThanOrEqual(100);
    expect(ratingAfter(MAX_RATING, 100, true, 0)).toBeLessThanOrEqual(MAX_RATING);
  });

  it('con el ELO del ejercicio, applyResult lo sube, apunta el máximo y lo cuenta', () => {
    const { campaign, events } = applyResult(conElo(1000), true, 1100);

    expect(campaign.rating).toBeGreaterThan(1000);
    expect(campaign.peakRating).toBe(campaign.rating);
    expect(events).toContainEqual({ kind: 'rating', from: 1000, to: campaign.rating });
  });

  it('al fallar lo baja pero el máximo se queda', () => {
    const { campaign, events } = applyResult(conElo(1000), false, 1000);

    expect(campaign.rating).toBeLessThan(1000);
    expect(campaign.peakRating).toBe(1000);
    expect(events).toContainEqual({ kind: 'rating', from: 1000, to: campaign.rating });
  });

  it('sin ELO del ejercicio, o sin ELO propio todavía, no cambia nada', () => {
    expect(applyResult(conElo(1000), true).campaign.rating).toBe(1000);
    expect(applyResult(newCampaign(), true, 1200).campaign.rating).toBe(0);
  });

  it('a lo largo de una ronda acertándolo todo el ELO sube de verdad', () => {
    let campaign = conElo(900);
    for (let i = 0; i < CHAPTERS.length * BLOCK_SIZE; i++) {
      // Siempre se pide el ejercicio que toca: el ELO del perrito más el desvío del puesto
      campaign = applyResult(campaign, true, campaign.rating + currentStep(campaign).eloOffset).campaign;
    }

    expect(campaign.rating - 900).toBeGreaterThan(250);
  });

  it('y fallando todo, baja pero el ejercicio que se pide es cada vez más fácil', () => {
    let campaign = conElo(1500);
    for (let i = 0; i < 6; i++) {
      campaign = applyResult(campaign, false, campaign.rating + currentStep(campaign).eloOffset).campaign;
    }

    expect(campaign.rating).toBeLessThan(1500);
    expect(campaign.rating).toBeGreaterThan(1200);
  });
});

describe('galletas y pelajes de la campaña guardada', () => {
  it('una campaña nueva no tiene galletas y lleva el pelaje de siempre', () => {
    expect(newCampaign()).toMatchObject({ cookies: 0, skin: 'choco', skins: ['choco'] });
  });

  it('lo guardado se conserva y lo raro se corrige: pelajes que no existen, uno puesto que no se tiene, galletas negativas', () => {
    const buena = sanitizeCampaign({ ...newCampaign(), cookies: 321, skin: 'golden', skins: ['choco', 'golden'] });
    expect(buena).toMatchObject({ cookies: 321, skin: 'golden', skins: ['choco', 'golden'] });

    const rota = sanitizeCampaign({ ...newCampaign(), cookies: -7, skin: 'night', skins: ['golden', 'volador', 9, 'golden'] });
    expect(rota.cookies).toBe(0);
    // El original siempre se tiene, no se repite y lo desconocido se descarta; el puesto tiene que ser uno de los suyos
    expect(rota.skins).toEqual(['choco', 'golden']);
    expect(rota.skin).toBe('choco');
  });

  it('una campaña de antes de los pelajes (sin esos datos) sigue valiendo', () => {
    const vieja: Record<string, unknown> = { ...newCampaign() };
    delete vieja['cookies'];
    delete vieja['skin'];
    delete vieja['skins'];

    expect(sanitizeCampaign(vieja)).toMatchObject({ cookies: 0, skin: 'choco', skins: ['choco'] });
  });
});

describe('los días seguidos jugando', () => {
  const conRacha = (days: number, lastDay: string): RunnerCampaign => ({ ...newCampaign(), days, lastDay });

  it('el día se escribe AAAA-MM-DD con la fecha del dispositivo', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(dayKey(new Date(2026, 11, 31, 0, 1))).toBe('2026-12-31');
  });

  it('la primera vez que se juega empieza la racha en un día', () => {
    const { campaign, changed } = touchDay(newCampaign(), '2026-03-10');

    expect(changed).toBe(true);
    expect(campaign).toMatchObject({ days: 1, lastDay: '2026-03-10' });
  });

  it('jugar otra vez el mismo día no cambia nada', () => {
    const base = conRacha(4, '2026-03-10');
    const { campaign, changed } = touchDay(base, '2026-03-10');

    expect(changed).toBe(false);
    expect(campaign).toBe(base);
  });

  it('al día siguiente la racha sube, también cruzando de mes y de año', () => {
    expect(touchDay(conRacha(4, '2026-03-10'), '2026-03-11').campaign.days).toBe(5);
    expect(touchDay(conRacha(2, '2026-02-28'), '2026-03-01').campaign.days).toBe(3);
    expect(touchDay(conRacha(9, '2025-12-31'), '2026-01-01').campaign.days).toBe(10);
  });

  it('con un hueco de uno o más días la racha vuelve a empezar', () => {
    expect(touchDay(conRacha(7, '2026-03-10'), '2026-03-12').campaign).toMatchObject({ days: 1, lastDay: '2026-03-12' });
    expect(touchDay(conRacha(7, '2026-03-10'), '2026-04-10').campaign.days).toBe(1);
  });

  it('la racha que se enseña sigue viva si se jugó hoy o ayer; si no, se rompió', () => {
    expect(activeDayStreak(conRacha(5, '2026-03-10'), '2026-03-10')).toBe(5);
    expect(activeDayStreak(conRacha(5, '2026-03-10'), '2026-03-11')).toBe(5);
    expect(activeDayStreak(conRacha(5, '2026-03-10'), '2026-03-12')).toBe(0);
    expect(activeDayStreak(newCampaign(), '2026-03-12')).toBe(0);
  });

  it('lo guardado se limpia: un día con otro formato o una racha negativa se descartan', () => {
    expect(sanitizeCampaign({ ...newCampaign(), days: 3, lastDay: '2026-03-10' })).toMatchObject({ days: 3, lastDay: '2026-03-10' });
    expect(sanitizeCampaign({ ...newCampaign(), days: -2, lastDay: 'ayer' })).toMatchObject({ days: 0, lastDay: '' });
  });
});

describe('lo que se ha visto de la historia', () => {
  it('se marca una vez y se recuerda', () => {
    const campaign = markSeen(newCampaign(), 'prologue');

    expect(hasSeen(campaign, 'prologue')).toBe(true);
    expect(hasSeen(campaign, 'epilogue')).toBe(false);
    expect(markSeen(campaign, 'prologue')).toBe(campaign);
    expect(markSeen(campaign, 'epilogue').seen).toEqual(['prologue', 'epilogue']);
  });
});

describe('sanitizeCampaign: lo guardado puede venir roto', () => {
  it.each([[null], [undefined], ['texto'], [42], [[]], [{}], [{ version: 1 }], [{ version: 3 }]])('%j da una campaña nueva', (raw) => {
    expect(sanitizeCampaign(raw)).toEqual(newCampaign());
  });

  it('conserva una campaña válida tal cual', () => {
    const campaign = jugar(conCapitulos(2), [true, false, true]).campaign;

    expect(sanitizeCampaign(JSON.parse(JSON.stringify(campaign)))).toEqual(campaign);
  });

  it('acota lo que se sale de rango y descarta lo que no entiende', () => {
    const limpia = sanitizeCampaign({
      version: 2,
      round: -4,
      rating: 99999,
      peakRating: 'alto',
      chapter: 999,
      solvedInBlock: 77,
      failsInBlock: -5,
      puzzles: 'muchos',
      mastery: { fork: { solved: 3, failed: 'x', lastSeen: -2 }, roto: 'no', otro: null },
      powers: ['nose', 'nose', 'volar', 7],
      stars: [3, 0, 9, 'a'],
      seen: ['prologue', 3, 'prologue'],
      review: { theme: 'fork', left: 99 },
    });

    expect(limpia.chapter).toBe(CHAPTERS.length - 1);
    expect(limpia.round).toBe(0);
    expect(limpia.rating).toBe(MAX_RATING);
    expect(limpia.peakRating).toBe(MAX_RATING);
    expect(limpia.solvedInBlock).toBe(BLOCK_SIZE - 1);
    expect(limpia.failsInBlock).toBe(0);
    expect(limpia.puzzles).toBe(0);
    expect(limpia.mastery).toEqual({ fork: { solved: 3, failed: 0, lastSeen: 0 } });
    expect(limpia.powers).toEqual(['nose']);
    expect(limpia.stars).toEqual([3, 1, 3, 1]);
    expect(limpia.seen).toEqual(['prologue']);
    expect(limpia.review?.theme).toBe('fork');
    expect(limpia.review!.left).toBeLessThanOrEqual(REVIEW_SIZE);
  });

  it('un repaso sin tema o sin ejercicios por hacer se descarta', () => {
    expect(sanitizeCampaign({ version: 2, review: { theme: 'fork', left: 0 } }).review).toBeNull();
    expect(sanitizeCampaign({ version: 2, review: { left: 2 } }).review).toBeNull();
  });
});
