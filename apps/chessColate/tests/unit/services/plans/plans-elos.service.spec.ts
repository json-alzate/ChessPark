import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { PlanElos } from '@chesspark/models';
import { EloCalculatorService, UidGeneratorService } from '@chesspark/common-utils';
import { PlansElosFacadeService } from '@chesspark/state';

import { PlanElosRepository } from '@services/firestore/plan-elos.repository';
import { ProfileService } from '@services/account/profile.service';
import { PlansElosService } from '@services/plans/plans-elos.service';

/** Cálculo de elo determinista: victoria +10, empate 0, derrota -10. */
const eloCalculator = {
  calculateElo: jest.fn((current: number, _puzzle: number, result: 1 | 0.5 | 0) => ({
    newElo: current + (result === 1 ? 10 : result === 0.5 ? 0 : -10),
    change: 0,
    expectedOutcome: 0.5,
  })),
};

const planElos = (extra: Partial<PlanElos> = {}): PlanElos => ({
  uid: 'e1',
  uidUser: 'u1',
  uidPlan: 'p1',
  themes: { fork: 1600, pin: 1400 },
  openings: { Sicilian: 1550 },
  total: 1600,
  maxTotal: 1650,
  maxThemes: { fork: 1620, pin: 1400 },
  maxOpenings: { Sicilian: 1550 },
  ...extra,
});

describe('PlansElosService', () => {
  let service: PlansElosService;
  let facade: {
    getPlanElo$: jest.Mock;
    requestUpdatePlanElos: jest.Mock;
    requestAddOnePlanElo: jest.Mock;
  };
  let repository: { getPlanElos: jest.Mock };
  let profileService: { getProfile: { uid: string } | null };

  beforeEach(() => {
    eloCalculator.calculateElo.mockClear();
    facade = {
      getPlanElo$: jest.fn().mockReturnValue(of(null)),
      requestUpdatePlanElos: jest.fn(),
      requestAddOnePlanElo: jest.fn(),
    };
    repository = { getPlanElos: jest.fn() };
    profileService = { getProfile: { uid: 'u1' } };
    TestBed.configureTestingModule({
      providers: [
        { provide: PlansElosFacadeService, useValue: facade },
        { provide: PlanElosRepository, useValue: repository },
        { provide: ProfileService, useValue: profileService },
        { provide: EloCalculatorService, useValue: eloCalculator },
        { provide: UidGeneratorService, useValue: { generateSimpleUid: () => 'uid-nuevo' } },
      ],
    });
    service = TestBed.inject(PlansElosService);
  });

  describe('calculatePlanElos', () => {
    describe('plan sin elos previos', () => {
      it('crea el documento (add, no update) con uid generado, usuario y plan', async () => {
        await service.calculatePlanElos(1500, 1, 'p1', 'u1', ['fork'], 'Sicilian');

        expect(facade.requestUpdatePlanElos).not.toHaveBeenCalled();
        expect(facade.requestAddOnePlanElo).toHaveBeenCalledTimes(1);
        expect(facade.requestAddOnePlanElo.mock.calls[0][0]).toMatchObject({
          uid: 'uid-nuevo',
          uidUser: 'u1',
          uidPlan: 'p1',
        });
      });

      it('parte de 1500 en total, temas y apertura, y aplica el resultado', async () => {
        await service.calculatePlanElos(1500, 1, 'p1', 'u1', ['fork', 'pin'], 'Sicilian');

        const saved: PlanElos = facade.requestAddOnePlanElo.mock.calls[0][0];
        expect(saved.total).toBe(1510);
        expect(saved.themes).toEqual({ fork: 1510, pin: 1510 });
        expect(saved.openings).toEqual({ Sicilian: 1510 });
      });

      it('con victoria marca récord total (supera el 1500 inicial) y guarda el máximo', async () => {
        const info = await service.calculatePlanElos(1500, 1, 'p1', 'u1', [], '');

        expect(info.isNewTotalRecord).toBe(true);
        expect(facade.requestAddOnePlanElo.mock.calls[0][0].maxTotal).toBe(1510);
      });

      it('con derrota no hay récord total y el máximo queda en 1500', async () => {
        const info = await service.calculatePlanElos(1500, 0, 'p1', 'u1', [], '');

        expect(info.isNewTotalRecord).toBe(false);
        const saved: PlanElos = facade.requestAddOnePlanElo.mock.calls[0][0];
        expect(saved.total).toBe(1490);
        expect(saved.maxTotal).toBe(1500);
      });

      it('el primer elo de cada tema y apertura cuenta como récord', async () => {
        const info = await service.calculatePlanElos(1500, 0.5, 'p1', 'u1', ['fork', 'pin'], 'Sicilian');

        expect(info.isNewThemeRecord).toBe(true);
        expect(info.newThemeRecords).toEqual(['fork', 'pin']);
        expect(info.isNewOpeningRecord).toBe(true);
        expect(info.newOpeningRecord).toBe('Sicilian');
      });
    });

    describe('plan con elos previos', () => {
      beforeEach(() => {
        facade.getPlanElo$.mockReturnValue(of(planElos()));
      });

      it('lee los elos del plan indicado', async () => {
        await service.calculatePlanElos(1500, 1, 'p1', 'u1', [], '');

        expect(facade.getPlanElo$).toHaveBeenCalledWith('p1');
      });

      it('actualiza (update, no add) conservando el uid del documento', async () => {
        await service.calculatePlanElos(1500, 1, 'p1', 'u1', ['fork'], 'Sicilian');

        expect(facade.requestAddOnePlanElo).not.toHaveBeenCalled();
        expect(facade.requestUpdatePlanElos).toHaveBeenCalledTimes(1);
        expect(facade.requestUpdatePlanElos.mock.calls[0][0].uid).toBe('e1');
      });

      it('sube total, tema y apertura a partir de sus valores actuales', async () => {
        await service.calculatePlanElos(1500, 1, 'p1', 'u1', ['fork'], 'Sicilian');

        const saved: PlanElos = facade.requestUpdatePlanElos.mock.calls[0][0];
        expect(saved.total).toBe(1610);
        expect(saved.themes).toEqual({ fork: 1610, pin: 1400 });
        expect(saved.openings).toEqual({ Sicilian: 1560 });
      });

      it('pasa a la calculadora el elo del puzzle y el resultado', async () => {
        await service.calculatePlanElos(1777, 0.5, 'p1', 'u1', [], '');

        expect(eloCalculator.calculateElo).toHaveBeenCalledWith(1600, 1777, 0.5);
      });

      it('no marca récord cuando el nuevo elo no supera el máximo guardado', async () => {
        // total 1600 -> 1610 sigue por debajo del máximo 1650; fork 1610 < 1620; Sicilian 1560 > 1550 sí.
        const info = await service.calculatePlanElos(1500, 1, 'p1', 'u1', ['fork'], 'Sicilian');

        expect(info.isNewTotalRecord).toBe(false);
        expect(info.isNewThemeRecord).toBe(false);
        expect(info.newThemeRecords).toEqual([]);
        expect(info.isNewOpeningRecord).toBe(true);
      });

      it('marca récord total y sube el máximo cuando lo supera', async () => {
        facade.getPlanElo$.mockReturnValue(of(planElos({ total: 1645, maxTotal: 1650 })));

        const info = await service.calculatePlanElos(1500, 1, 'p1', 'u1', [], '');

        expect(info.isNewTotalRecord).toBe(true);
        expect(facade.requestUpdatePlanElos.mock.calls[0][0].maxTotal).toBe(1655);
      });

      it('registra solo los temas que baten su máximo', async () => {
        facade.getPlanElo$.mockReturnValue(
          of(planElos({ themes: { fork: 1620, pin: 1300 }, maxThemes: { fork: 1620, pin: 1400 } }))
        );

        const info = await service.calculatePlanElos(1500, 1, 'p1', 'u1', ['fork', 'pin'], '');

        expect(info.newThemeRecords).toEqual(['fork']);
        expect(facade.requestUpdatePlanElos.mock.calls[0][0].maxThemes).toEqual({
          fork: 1630,
          pin: 1400,
        });
      });

      it('sin apertura no toca las aperturas ni marca récord de apertura', async () => {
        const info = await service.calculatePlanElos(1500, 1, 'p1', 'u1', [], '');

        expect(info.isNewOpeningRecord).toBe(false);
        expect(info.newOpeningRecord).toBeUndefined();
        expect(facade.requestUpdatePlanElos.mock.calls[0][0].openings).toEqual({ Sicilian: 1550 });
      });

      it('calcula una apertura nueva desde 1500', async () => {
        await service.calculatePlanElos(1500, 1, 'p1', 'u1', [], 'French');

        const saved: PlanElos = facade.requestUpdatePlanElos.mock.calls[0][0];
        expect(saved.openings).toEqual({ Sicilian: 1550, French: 1510 });
      });

      it('no muta el objeto que vino del store (estado inmutable de NgRx)', async () => {
        const frozen = planElos();
        Object.freeze(frozen);
        Object.freeze(frozen.themes);
        Object.freeze(frozen.openings);
        Object.freeze(frozen.maxThemes);
        Object.freeze(frozen.maxOpenings);
        facade.getPlanElo$.mockReturnValue(of(frozen));

        await expect(
          service.calculatePlanElos(1500, 1, 'p1', 'u1', ['fork', 'nuevo'], 'French')
        ).resolves.toBeDefined();

        expect(frozen.total).toBe(1600);
        expect(frozen.themes).toEqual({ fork: 1600, pin: 1400 });
      });

      it('completa los máximos que faltan en documentos antiguos usando el total actual', async () => {
        facade.getPlanElo$.mockReturnValue(
          of(planElos({ maxTotal: undefined, maxThemes: undefined, maxOpenings: undefined, total: 1600 }))
        );

        const info = await service.calculatePlanElos(1500, 1, 'p1', 'u1', ['fork'], 'Sicilian');

        const saved: PlanElos = facade.requestUpdatePlanElos.mock.calls[0][0];
        expect(saved.maxTotal).toBe(1610);
        expect(info.isNewTotalRecord).toBe(true);
        expect(saved.maxThemes).toEqual({ fork: 1610 });
      });

      it('un documento con uid vacío se trata como nuevo: genera uid y hace add', async () => {
        facade.getPlanElo$.mockReturnValue(of(planElos({ uid: '' })));

        await service.calculatePlanElos(1500, 1, 'p9', 'u2', [], '');

        expect(facade.requestUpdatePlanElos).not.toHaveBeenCalled();
        expect(facade.requestAddOnePlanElo.mock.calls[0][0]).toMatchObject({
          uid: 'uid-nuevo',
          uidUser: 'u2',
          uidPlan: 'p9',
        });
      });

      it('un total guardado en 0 se trata como 1500', async () => {
        facade.getPlanElo$.mockReturnValue(of(planElos({ total: 0, maxTotal: 1500 })));

        await service.calculatePlanElos(1500, 1, 'p1', 'u1', [], '');

        expect(facade.requestUpdatePlanElos.mock.calls[0][0].total).toBe(1510);
      });
    });
  });

  describe('getWeakness', () => {
    it('devuelve el tema con el elo más bajo', () => {
      expect(service.getWeakness({ fork: 1500, pin: 1300, skewer: 1700 })).toBe('pin');
    });

    it('con empate devuelve el primero', () => {
      expect(service.getWeakness({ fork: 1400, pin: 1400 })).toBe('fork');
    });

    it('devuelve null con un mapa vacío o ausente', () => {
      expect(service.getWeakness({})).toBeNull();
      expect(service.getWeakness(null as unknown as Record<string, number>)).toBeNull();
    });
  });

  describe('getStrongestTheme', () => {
    it('devuelve el tema con el elo más alto', () => {
      expect(service.getStrongestTheme({ fork: 1500, pin: 1300, skewer: 1700 })).toBe('skewer');
    });

    it('con empate devuelve el primero', () => {
      expect(service.getStrongestTheme({ fork: 1400, pin: 1400 })).toBe('fork');
    });

    it('devuelve null con un mapa vacío o ausente', () => {
      expect(service.getStrongestTheme({})).toBeNull();
      expect(service.getStrongestTheme(undefined as unknown as Record<string, number>)).toBeNull();
    });
  });

  describe('getOnePlanElo', () => {
    it('consulta Firestore con el plan y el uid del perfil', async () => {
      const elos = planElos();
      repository.getPlanElos.mockResolvedValue(elos);

      const result = await service.getOnePlanElo('p1');

      expect(repository.getPlanElos).toHaveBeenCalledWith('p1', 'u1');
      expect(result).toBe(elos);
    });

    it('sin perfil devuelve un objeto vacío y no consulta Firestore', async () => {
      profileService.getProfile = null;

      await expect(service.getOnePlanElo('p1')).resolves.toEqual({});
      expect(repository.getPlanElos).not.toHaveBeenCalled();
    });
  });

  describe('incrementPlayCount', () => {
    it('suma 1 a timesPlayed del documento que está en el store, sin ir a Firestore', async () => {
      facade.getPlanElo$.mockReturnValue(of(planElos({ timesPlayed: 4 })));

      await service.incrementPlayCount('p1', 'u1');

      expect(repository.getPlanElos).not.toHaveBeenCalled();
      expect(facade.requestUpdatePlanElos).toHaveBeenCalledWith(
        expect.objectContaining({ uid: 'e1', timesPlayed: 5, total: 1600 })
      );
    });

    it('si timesPlayed no existía, queda en 1', async () => {
      facade.getPlanElo$.mockReturnValue(of(planElos({ timesPlayed: undefined })));

      await service.incrementPlayCount('p1', 'u1');

      expect(facade.requestUpdatePlanElos.mock.calls[0][0].timesPlayed).toBe(1);
    });

    it('si el store no lo tiene, lo busca en Firestore y lo actualiza', async () => {
      repository.getPlanElos.mockResolvedValue(planElos({ uid: 'remoto', timesPlayed: 2 }));

      await service.incrementPlayCount('p1', 'u1');

      expect(repository.getPlanElos).toHaveBeenCalledWith('p1', 'u1');
      expect(facade.requestUpdatePlanElos).toHaveBeenCalledWith(
        expect.objectContaining({ uid: 'remoto', timesPlayed: 3 })
      );
      expect(facade.requestAddOnePlanElo).not.toHaveBeenCalled();
    });

    it('si no existe en ninguna parte, crea un documento nuevo con timesPlayed 1 y elo 1500', async () => {
      repository.getPlanElos.mockResolvedValue({});

      await service.incrementPlayCount('p1', 'u1');

      expect(facade.requestUpdatePlanElos).not.toHaveBeenCalled();
      expect(facade.requestAddOnePlanElo).toHaveBeenCalledWith({
        uid: 'uid-nuevo',
        uidUser: 'u1',
        uidPlan: 'p1',
        openings: {},
        themes: {},
        total: 1500,
        timesPlayed: 1,
      });
    });

    it('un documento del store sin uid se ignora y se consulta Firestore', async () => {
      facade.getPlanElo$.mockReturnValue(of(planElos({ uid: '' })));
      repository.getPlanElos.mockResolvedValue({});

      await service.incrementPlayCount('p1', 'u1');

      expect(repository.getPlanElos).toHaveBeenCalled();
      expect(facade.requestAddOnePlanElo).toHaveBeenCalled();
    });
  });
});
