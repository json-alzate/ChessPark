import { Block, Plan, UserPuzzle } from '@cpark/models';

import { TrainingSessionService } from '../../training/training-session.service';

/**
 * Pruebas del flujo de sesión en aislamiento: sin cronómetro, sin tablero y
 * sin Angular. Cubren lo que la pantalla de entrenamiento delega aquí: en qué
 * bloque se está, cuántos ejercicios lleva, y qué toca tras cada resultado.
 */

function makeBlock(overrides: Partial<Block> = {}): Block {
  return {
    time: 60,
    puzzlesCount: 0,
    theme: 'mateIn1',
    elo: 1500,
    color: 'random',
    puzzles: [],
    puzzlesPlayed: [],
    ...overrides,
  };
}

function makePlan(blocks: Block[], overrides: Partial<Plan> = {}): Plan {
  return {
    uid: 'plan-1',
    blocks,
    createdAt: 0,
    planType: 'plan5',
    ...overrides,
  };
}

function makeUserPuzzle(uid: string, resolved = true): UserPuzzle {
  return {
    uid,
    uidUser: 'user-1',
    uidPuzzle: `puzzle-${uid}`,
    date: 0,
    resolved,
    failByTime: false,
    resolvedTime: 5,
    currentEloUser: 1500,
    eloPuzzle: 1500,
    themes: ['mateIn1'],
  };
}

describe('TrainingSessionService', () => {
  let session: TrainingSessionService;

  beforeEach(() => {
    session = new TrainingSessionService();
  });

  describe('arranque', () => {
    it('sin plan no hay bloques ni bloque en juego, y la posición está antes del primero', () => {
      expect(session.plan).toBeNull();
      expect(session.blocks).toEqual([]);
      expect(session.currentBlock).toBeUndefined();
      expect(session.currentIndexBlock).toBe(-1);
      expect(session.countPuzzlesPlayedBlock).toBe(0);
      expect(session.totalPuzzlesInBlock).toBe(0);
      expect(session.isChangingBlock).toBe(false);
    });

    it('start adopta el plan y coloca la sesión antes del primer bloque, aunque venga de una rutina anterior', () => {
      session.start(makePlan([makeBlock({ puzzlesCount: 2 }), makeBlock()]));
      session.advanceToNextBlock();
      session.blockReady();
      session.registerPuzzleResult(makeUserPuzzle('a'));

      const next = makePlan([makeBlock({ puzzlesCount: 3 })], { uid: 'plan-2' });
      session.start(next);

      expect(session.plan).toBe(next);
      expect(session.blocks).toBe(next.blocks);
      expect(session.currentIndexBlock).toBe(-1);
      expect(session.currentBlock).toBeUndefined();
      expect(session.countPuzzlesPlayedBlock).toBe(0);
      expect(session.totalPuzzlesInBlock).toBe(0);
    });

    it('start no cierra un cambio de bloque en curso: eso lo hace quien presentó el bloque', () => {
      session.start(makePlan([makeBlock(), makeBlock()]));
      session.advanceToNextBlock();
      expect(session.isChangingBlock).toBe(true);

      session.start(makePlan([makeBlock()], { uid: 'plan-2' }));

      expect(session.isChangingBlock).toBe(true);
      session.blockReady();
      expect(session.isChangingBlock).toBe(false);
    });
  });

  describe('cambio de bloque', () => {
    it('advanceToNextBlock entra en el siguiente bloque con su cuota y el contador a cero, y abre el cambio de bloque', () => {
      const plan = makePlan([
        makeBlock({ puzzlesCount: 3 }),
        makeBlock({ puzzlesCount: 0 }),
      ]);
      session.start(plan);

      expect(session.advanceToNextBlock()).toBe('next-block');
      expect(session.currentIndexBlock).toBe(0);
      expect(session.currentBlock).toBe(plan.blocks[0]);
      expect(session.totalPuzzlesInBlock).toBe(3);
      expect(session.countPuzzlesPlayedBlock).toBe(0);
      expect(session.isChangingBlock).toBe(true);

      session.blockReady();
      expect(session.isChangingBlock).toBe(false);
      session.registerPuzzleResult(makeUserPuzzle('a'));
      expect(session.countPuzzlesPlayedBlock).toBe(1);

      // El contador del bloque anterior no se arrastra al siguiente.
      expect(session.advanceToNextBlock()).toBe('next-block');
      expect(session.currentIndexBlock).toBe(1);
      expect(session.currentBlock).toBe(plan.blocks[1]);
      expect(session.totalPuzzlesInBlock).toBe(0);
      expect(session.countPuzzlesPlayedBlock).toBe(0);
      expect(session.isChangingBlock).toBe(true);
    });

    it('después del último bloque devuelve plan-finished y no deja ningún cambio en curso', () => {
      session.start(makePlan([makeBlock(), makeBlock()]));
      session.advanceToNextBlock();
      session.blockReady();
      session.advanceToNextBlock();
      session.blockReady();

      expect(session.advanceToNextBlock()).toBe('plan-finished');
      expect(session.currentIndexBlock).toBe(2);
      expect(session.currentBlock).toBeUndefined();
      expect(session.isChangingBlock).toBe(false);
    });

    it('sin plan, avanzar termina en el acto', () => {
      expect(session.advanceToNextBlock()).toBe('plan-finished');
      expect(session.isChangingBlock).toBe(false);
    });
  });

  describe('registro de resultados', () => {
    it('anota el ejercicio en el bloque en juego con copias nuevas del plan y del bloque, sin tocar los originales', () => {
      const plan = makePlan([makeBlock(), makeBlock()]);
      session.start(plan);
      session.advanceToNextBlock();
      session.blockReady();

      const played = makeUserPuzzle('a');
      session.registerPuzzleResult(played);
      session.registerPuzzleResult(makeUserPuzzle('b', false));

      expect(session.countPuzzlesPlayedBlock).toBe(2);
      expect(session.plan).not.toBe(plan);
      expect(session.currentBlock).not.toBe(plan.blocks[0]);
      expect(session.currentBlock?.puzzlesPlayed.map((p) => p.uid)).toEqual(['a', 'b']);
      expect(session.currentBlock?.puzzlesPlayed[0]).toBe(played);
      expect(plan.blocks[0].puzzlesPlayed).toEqual([]);
      expect(session.plan?.uid).toBe('plan-1');
    });

    it('los demás bloques se comparten con el plan anterior', () => {
      const plan = makePlan([makeBlock(), makeBlock()]);
      session.start(plan);
      session.advanceToNextBlock();

      session.registerPuzzleResult(makeUserPuzzle('a'));

      expect(session.blocks[1]).toBe(plan.blocks[1]);
    });

    it('sin bloque en juego no anota ni cuenta nada', () => {
      session.registerPuzzleResult(makeUserPuzzle('a'));
      expect(session.countPuzzlesPlayedBlock).toBe(0);

      const plan = makePlan([makeBlock()]);
      session.start(plan);
      session.registerPuzzleResult(makeUserPuzzle('b'));

      expect(session.countPuzzlesPlayedBlock).toBe(0);
      expect(session.plan).toBe(plan);
      expect(plan.blocks[0].puzzlesPlayed).toEqual([]);
    });
  });

  describe('decisión tras cada ejercicio', () => {
    it('en un bloque por tiempo (cuota 0) siempre toca otro ejercicio mientras el reloj no venza', () => {
      session.start(makePlan([makeBlock({ puzzlesCount: 0 })]));
      session.advanceToNextBlock();
      session.blockReady();

      for (let i = 0; i < 25; i++) {
        session.registerPuzzleResult(makeUserPuzzle(`p${i}`));
        expect(session.isBlockQuotaReached).toBe(false);
        expect(session.nextStepAfterPuzzle(false)).toBe('next-puzzle');
      }
    });

    it('en un bloque por cantidad toca el bloque siguiente justo al completar la cuota', () => {
      session.start(makePlan([makeBlock({ puzzlesCount: 2 }), makeBlock()]));
      session.advanceToNextBlock();
      session.blockReady();

      session.registerPuzzleResult(makeUserPuzzle('a'));
      expect(session.isBlockQuotaReached).toBe(false);
      expect(session.nextStepAfterPuzzle(false)).toBe('next-puzzle');

      session.registerPuzzleResult(makeUserPuzzle('b', false));
      expect(session.isBlockQuotaReached).toBe(true);
      expect(session.nextStepAfterPuzzle(false)).toBe('next-block');
    });

    it('si el tiempo del bloque venció, toca el bloque siguiente aunque falten ejercicios', () => {
      session.start(makePlan([makeBlock({ puzzlesCount: 5 }), makeBlock()]));
      session.advanceToNextBlock();
      session.blockReady();
      session.registerPuzzleResult(makeUserPuzzle('a'));

      expect(session.nextStepAfterPuzzle(true)).toBe('next-block');
      expect(session.nextStepAfterPuzzle(false)).toBe('next-puzzle');
    });

    it('sin bloque en juego toca cerrar el plan, salvo que el tiempo mande cambiar de bloque', () => {
      expect(session.nextStepAfterPuzzle(false)).toBe('plan-finished');

      session.start(makePlan([makeBlock()]));
      expect(session.nextStepAfterPuzzle(false)).toBe('plan-finished');

      session.advanceToNextBlock();
      session.blockReady();
      session.advanceToNextBlock();
      expect(session.currentBlock).toBeUndefined();
      expect(session.nextStepAfterPuzzle(false)).toBe('plan-finished');
      expect(session.nextStepAfterPuzzle(true)).toBe('next-block');
    });
  });

  describe('reset y estado montado', () => {
    it('reset vuelve antes del primer bloque y cierra el cambio en curso, pero conserva el plan', () => {
      const plan = makePlan([makeBlock({ puzzlesCount: 2 }), makeBlock()]);
      session.start(plan);
      session.advanceToNextBlock();
      session.blockReady();
      session.registerPuzzleResult(makeUserPuzzle('a'));
      session.advanceToNextBlock();
      expect(session.isChangingBlock).toBe(true);

      session.reset();

      expect(session.currentIndexBlock).toBe(-1);
      expect(session.currentBlock).toBeUndefined();
      expect(session.countPuzzlesPlayedBlock).toBe(0);
      expect(session.totalPuzzlesInBlock).toBe(0);
      expect(session.isChangingBlock).toBe(false);
      expect(session.plan?.uid).toBe('plan-1');
      expect(session.plan?.blocks[0].puzzlesPlayed).toHaveLength(1);
    });

    it('los setters montan la sesión en un bloque concreto y la decisión los respeta', () => {
      const plan = makePlan([makeBlock(), makeBlock({ puzzlesCount: 3 })]);
      session.plan = plan;
      session.currentIndexBlock = 1;
      session.totalPuzzlesInBlock = 3;
      session.countPuzzlesPlayedBlock = 2;

      expect(session.currentBlock).toBe(plan.blocks[1]);
      expect(session.nextStepAfterPuzzle(false)).toBe('next-puzzle');

      session.registerPuzzleResult(makeUserPuzzle('c'));

      expect(session.countPuzzlesPlayedBlock).toBe(3);
      expect(session.nextStepAfterPuzzle(false)).toBe('next-block');
    });

    it('reasignar el plan (datos de cierre) no mueve la posición', () => {
      session.start(makePlan([makeBlock(), makeBlock()]));
      session.advanceToNextBlock();
      session.blockReady();
      session.registerPuzzleResult(makeUserPuzzle('a'));

      session.plan = { ...(session.plan as Plan), isFinished: true, uidUser: 'user-1' };

      expect(session.plan?.isFinished).toBe(true);
      expect(session.currentIndexBlock).toBe(0);
      expect(session.countPuzzlesPlayedBlock).toBe(1);
      expect(session.currentBlock?.puzzlesPlayed).toHaveLength(1);
    });
  });
});
