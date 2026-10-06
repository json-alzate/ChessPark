import { Plan, Puzzle, UserPuzzle } from '@cpark/models';

import {
  addPuzzlePlayedToPlan,
  buildUserPuzzle,
  BuildUserPuzzleInput,
} from '../../training/user-puzzle.util';

function makePuzzle(overrides: Partial<Puzzle> = {}): Puzzle {
  return {
    uid: 'puzzle-1',
    fen: '8/8/8/8/8/8/8/8 w - - 0 1',
    moves: 'e2e4',
    rating: 1600,
    ratingDeviation: 50,
    popularity: 90,
    randomNumberQuery: 0.5,
    nbPlays: 100,
    themes: ['mateIn1'],
    gameUrl: '',
    openingFamily: 'sicilian',
    openingVariation: 'najdorf',
    timeUsed: 12,
    ...overrides,
  } as Puzzle;
}

function makeInput(
  overrides: Partial<BuildUserPuzzleInput> = {}
): BuildUserPuzzleInput {
  return {
    puzzle: makePuzzle(),
    result: 'good',
    uid: 'record-1',
    uidUser: 'user-1',
    currentEloUser: 1450,
    date: 42,
    ...overrides,
  };
}

describe('buildUserPuzzle', () => {
  it('marca resuelto solo con el resultado good', () => {
    const good = buildUserPuzzle(makeInput({ result: 'good' }));
    const bad = buildUserPuzzle(makeInput({ result: 'bad' }));
    const timeOut = buildUserPuzzle(makeInput({ result: 'timeOut' }));

    expect(good.resolved).toBe(true);
    expect(good.failByTime).toBe(false);

    expect(bad.resolved).toBe(false);
    expect(bad.failByTime).toBe(false);

    expect(timeOut.resolved).toBe(false);
    expect(timeOut.failByTime).toBe(true);
  });

  it('copia los datos del puzzle y del entorno', () => {
    const record = buildUserPuzzle(makeInput());

    expect(record).toMatchObject({
      uid: 'record-1',
      uidUser: 'user-1',
      uidPuzzle: 'puzzle-1',
      date: 42,
      resolvedTime: 12,
      currentEloUser: 1450,
      eloPuzzle: 1600,
      themes: ['mateIn1'],
      openingFamily: 'sicilian',
      openingVariation: 'najdorf',
      fenPuzzle: '8/8/8/8/8/8/8/8 w - - 0 1',
    });
  });

  it('usa 0 de tiempo cuando el puzzle no trae timeUsed', () => {
    const record = buildUserPuzzle(
      makeInput({ puzzle: makePuzzle({ timeUsed: undefined }) })
    );

    expect(record.resolvedTime).toBe(0);
  });

  it('acepta un uidUser vacío para partidas sin sesión', () => {
    expect(buildUserPuzzle(makeInput({ uidUser: '' })).uidUser).toBe('');
  });
});

describe('addPuzzlePlayedToPlan', () => {
  function makePlan(): Plan {
    const block = (id: string, played: UserPuzzle[] = []) => ({
      time: 60,
      puzzlesCount: 0,
      puzzles: [],
      puzzlesPlayed: played,
      title: id,
    });
    return {
      uid: 'plan',
      blocks: [block('a'), block('b')],
      createdAt: 0,
      planType: 'plan1',
    } as unknown as Plan;
  }

  it('añade el registro al bloque indicado sin tocar los demás', () => {
    const plan = makePlan();
    const record = buildUserPuzzle(makeInput());

    const next = addPuzzlePlayedToPlan(plan, 1, record);

    expect(next.blocks[1].puzzlesPlayed).toEqual([record]);
    expect(next.blocks[0]).toBe(plan.blocks[0]);
  });

  it('no muta el plan original', () => {
    const plan = makePlan();
    const record = buildUserPuzzle(makeInput());

    const next = addPuzzlePlayedToPlan(plan, 0, record);

    expect(plan.blocks[0].puzzlesPlayed).toHaveLength(0);
    expect(next.blocks).not.toBe(plan.blocks);
  });

  it('conserva los registros previos y agrega el nuevo al final', () => {
    const first = buildUserPuzzle(makeInput({ uid: 'first' }));
    const second = buildUserPuzzle(makeInput({ uid: 'second' }));
    const plan = addPuzzlePlayedToPlan(makePlan(), 0, first);

    const next = addPuzzlePlayedToPlan(plan, 0, second);

    expect(next.blocks[0].puzzlesPlayed.map((p) => p.uid)).toEqual([
      'first',
      'second',
    ]);
  });

  it('tolera un bloque sin puzzlesPlayed', () => {
    const plan = makePlan();
    (plan.blocks[0] as { puzzlesPlayed?: UserPuzzle[] }).puzzlesPlayed =
      undefined;

    const next = addPuzzlePlayedToPlan(
      plan,
      0,
      buildUserPuzzle(makeInput())
    );

    expect(next.blocks[0].puzzlesPlayed).toHaveLength(1);
  });
});
