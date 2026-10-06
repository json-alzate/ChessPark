import { PublicPlan, PlanInteraction } from '@cpark/models';
import { publicPlansReducer, initialPublicPlansState } from '../../lib/public-plans/public-plans.reducer';
import {
  loadInteractionPlansSuccess,
  loadPlanInteractionSuccess,
} from '../../lib/public-plans/public-plans.actions';
import { getInteractionPlans } from '../../lib/public-plans/public-plans.selectors';
import { PublicPlansState } from '../../lib/public-plans/public-plans.state';

const plan = (uid: string): PublicPlan => ({ uid, title: uid } as unknown as PublicPlan);
const interaction = (planUid: string, liked: boolean): PlanInteraction =>
  ({ uid: `u1_${planUid}`, uidUser: 'u1', planUid, liked, played: false, saved: false } as PlanInteraction);

describe('publicPlans reducer: planes e interacciones sueltas', () => {
  it('guarda los planes de interacciones aparte del listado público', () => {
    const state = publicPlansReducer(
      undefined,
      loadInteractionPlansSuccess({ plans: [plan('a'), plan('b')] })
    );

    expect(state.interactionPlans).toEqual({ a: plan('a'), b: plan('b') });
    expect(state.ids).toEqual([]);
  });

  it('no pierde planes ya cargados al llegar otro lote', () => {
    let state: PublicPlansState = publicPlansReducer(
      undefined,
      loadInteractionPlansSuccess({ plans: [plan('a')] })
    );
    state = publicPlansReducer(state, loadInteractionPlansSuccess({ plans: [plan('b')] }));

    expect(Object.keys(state.interactionPlans).sort()).toEqual(['a', 'b']);
  });

  it('inserta la interacción cargada y reemplaza la existente del mismo plan', () => {
    let state = publicPlansReducer(
      undefined,
      loadPlanInteractionSuccess({ interaction: interaction('p1', false) })
    );
    expect(state.interactions).toHaveLength(1);

    state = publicPlansReducer(state, loadPlanInteractionSuccess({ interaction: interaction('p1', true) }));
    expect(state.interactions).toHaveLength(1);
    expect(state.interactions[0].liked).toBe(true);
  });

  it('ignora una interacción nula (el usuario no tiene like ni guardado)', () => {
    const before = publicPlansReducer(undefined, loadPlanInteractionSuccess({ interaction: null }));
    expect(before).toBe(initialPublicPlansState);
  });
});

describe('publicPlans selector getInteractionPlans', () => {
  it('devuelve los planes en el orden de los uids y omite los que faltan', () => {
    const state = {
      publicPlans: {
        ...initialPublicPlansState,
        interactionPlans: { a: plan('a'), c: plan('c') },
      },
    };

    const result = getInteractionPlans(['c', 'b', 'a'])(state as never);

    expect(result.map((p) => p.uid)).toEqual(['c', 'a']);
  });
});
