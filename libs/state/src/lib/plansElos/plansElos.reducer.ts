import { createReducer, on, Action } from '@ngrx/store';
import { PlansElosState, planElosStateAdapter } from './plansElos.state';

import {
  addOnePlanElo,
  updatePlanElos,
  addPlansElos,
} from './plansElos.actions';

export const initialPlansElosState: PlansElosState = planElosStateAdapter.getInitialState();

const _plansElosReducer = createReducer(
  initialPlansElosState,
  on(addOnePlanElo, (state, { planElo }) => 
    planElosStateAdapter.addOne(planElo, state)
  ),
  on(updatePlanElos, (state, { planElo }) => 
    planElosStateAdapter.updateOne(planElo, state)
  ),
  on(addPlansElos, (state, { plansElos }) => 
    planElosStateAdapter.addMany(plansElos, state)
  )
);

export function plansElosReducer(
  state: PlansElosState | undefined,
  action: Action
) {
  return _plansElosReducer(state, action);
}
