import {
  DEFAULT_PLAN_ELO,
  initialEloForCustomPlan,
  initialEloForDefaultPlan,
} from '../../plans/plan-initial-elo.util';

describe('initialEloForDefaultPlan', () => {
  it('usa el total como máximo cuando el perfil no tiene elos', () => {
    expect(initialEloForDefaultPlan('plan1', undefined, 1500)).toEqual({
      initialTotalElo: 1500,
      initialMaxElo: 1500,
    });
  });

  it('usa el máximo guardado del tipo de plan pedido', () => {
    const elos = { plan1MaxTotal: 1720, plan3MaxTotal: 1300 };

    expect(initialEloForDefaultPlan('plan1', elos, 1650)).toEqual({
      initialTotalElo: 1650,
      initialMaxElo: 1720,
    });
    expect(initialEloForDefaultPlan('plan3', elos, 1250)).toEqual({
      initialTotalElo: 1250,
      initialMaxElo: 1300,
    });
  });

  it('cae al total cuando no hay máximo guardado para ese plan', () => {
    const elos = { plan3MaxTotal: 1300 };

    expect(initialEloForDefaultPlan('warmup', elos, 1480)).toEqual({
      initialTotalElo: 1480,
      initialMaxElo: 1480,
    });
  });

  it('ignora un máximo guardado que no es número', () => {
    const elos = { plan1MaxTotal: 'mal' as unknown as number };

    expect(initialEloForDefaultPlan('plan1', elos, 1500)).toEqual({
      initialTotalElo: 1500,
      initialMaxElo: 1500,
    });
  });
});

describe('initialEloForCustomPlan', () => {
  it('usa 1500 como total y máximo cuando no hay elos de la rutina', () => {
    expect(initialEloForCustomPlan(null)).toEqual({
      initialTotalElo: DEFAULT_PLAN_ELO,
      initialMaxElo: DEFAULT_PLAN_ELO,
    });
    expect(initialEloForCustomPlan(undefined)).toEqual({
      initialTotalElo: DEFAULT_PLAN_ELO,
      initialMaxElo: DEFAULT_PLAN_ELO,
    });
  });

  it('usa los elos guardados de la rutina', () => {
    expect(initialEloForCustomPlan({ total: 1610, maxTotal: 1700 })).toEqual({
      initialTotalElo: 1610,
      initialMaxElo: 1700,
    });
  });

  it('toma el total como máximo si el documento no trae maxTotal', () => {
    expect(initialEloForCustomPlan({ total: 1610 })).toEqual({
      initialTotalElo: 1610,
      initialMaxElo: 1610,
    });
  });

  it('parte de 1500 si el documento existe pero no tiene total', () => {
    expect(initialEloForCustomPlan({})).toEqual({
      initialTotalElo: DEFAULT_PLAN_ELO,
      initialMaxElo: DEFAULT_PLAN_ELO,
    });
  });
});
