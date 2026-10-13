import { StreakStorageService } from '@features/records/services/streak-storage.service';
import { emptyStreakRecord } from '@features/streak/utils/streak.util';

import {
  makeStreakRecord,
  makeStreakRun,
} from '@tests/support/partidas-progreso-fixtures';

const RECORD_KEY = 'chessColate_streak_record';
const RUNS_KEY = 'chessColate_streak_runs';

describe('StreakStorageService', () => {
  let service: StreakStorageService;

  beforeEach(() => {
    localStorage.clear();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    service = new StreakStorageService();
  });

  afterEach(() => jest.restoreAllMocks());

  describe('récord', () => {
    it('sin nada guardado devuelve el récord vacío', () => {
      expect(service.getRecord()).toEqual(emptyStreakRecord());
    });

    it('setRecord y getRecord se corresponden', () => {
      const record = makeStreakRecord({ bestScore: 12, runsPlayed: 3, uidUser: 'u1' });

      service.setRecord(record);

      expect(service.getRecord()).toEqual(record);
    });

    it('completa con valores vacíos los campos que faltan en datos de versiones previas', () => {
      localStorage.setItem(RECORD_KEY, JSON.stringify({ bestScore: 7 }));

      expect(service.getRecord()).toEqual({ ...emptyStreakRecord(), bestScore: 7 });
    });

    it('con JSON corrupto devuelve el récord vacío sin lanzar', () => {
      localStorage.setItem(RECORD_KEY, '{corrupto');

      expect(service.getRecord()).toEqual(emptyStreakRecord());
    });

    it('si el dispositivo no deja escribir, setRecord no lanza', () => {
      jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('cuota llena');
      });

      expect(() => service.setRecord(makeStreakRecord({ bestScore: 1 }))).not.toThrow();
    });
  });

  describe('saveRun', () => {
    it('aplica la racha al récord, lo guarda y lo devuelve', () => {
      const run = makeStreakRun({ uid: 'r1', score: 8, finishedAt: 5_000, uidUser: 'u1' });

      const record = service.saveRun(run);

      expect(record).toMatchObject({
        bestScore: 8,
        bestRunUid: 'r1',
        achievedAt: 5_000,
        runsPlayed: 1,
        lastScore: 8,
        lastPlayedAt: 5_000,
        uidUser: 'u1',
      });
      expect(service.getRecord()).toEqual(record);
    });

    it('una racha peor suma partida y último intento, pero conserva la mejor marca', () => {
      service.saveRun(makeStreakRun({ uid: 'mejor', score: 10, finishedAt: 1_000 }));

      const record = service.saveRun(makeStreakRun({ uid: 'peor', score: 4, finishedAt: 2_000 }));

      expect(record).toMatchObject({
        bestScore: 10,
        bestRunUid: 'mejor',
        runsPlayed: 2,
        lastScore: 4,
        lastPlayedAt: 2_000,
      });
    });

    it('guarda la racha en el historial sin los uids de los puzzles', () => {
      service.saveRun(makeStreakRun({ uid: 'r1', puzzleUids: ['a', 'b', 'c'] }));

      const runs = service.getRuns();

      expect(runs).toHaveLength(1);
      expect(runs[0]).toMatchObject({ uid: 'r1', score: 5 });
      expect(runs[0].puzzleUids).toEqual([]);
    });

    it('el historial va de la más reciente a la más antigua', () => {
      service.saveRun(makeStreakRun({ uid: 'primera' }));
      service.saveRun(makeStreakRun({ uid: 'segunda' }));

      expect(service.getRuns().map((r) => r.uid)).toEqual(['segunda', 'primera']);
    });

    it('conserva solo las 20 rachas más recientes', () => {
      for (let i = 1; i <= 25; i++) {
        service.saveRun(makeStreakRun({ uid: `r${i}` }));
      }

      const runs = service.getRuns();

      expect(runs).toHaveLength(20);
      expect(runs[0].uid).toBe('r25');
      expect(runs[19].uid).toBe('r6');
    });

    it('si el dispositivo no deja escribir, igualmente devuelve el récord calculado', () => {
      jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('cuota llena');
      });

      const record = service.saveRun(makeStreakRun({ score: 9 }));

      expect(record.bestScore).toBe(9);
    });
  });

  describe('getRuns', () => {
    it('sin historial devuelve una lista vacía', () => {
      expect(service.getRuns()).toEqual([]);
    });

    it('con JSON corrupto devuelve una lista vacía', () => {
      localStorage.setItem(RUNS_KEY, 'no-es-json');

      expect(service.getRuns()).toEqual([]);
    });

    it('si lo guardado no es una lista devuelve una lista vacía', () => {
      localStorage.setItem(RUNS_KEY, JSON.stringify({ uid: 'x' }));

      expect(service.getRuns()).toEqual([]);
    });
  });
});
