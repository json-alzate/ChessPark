import { createReducer, on, Action } from '@ngrx/store';
import { PlanState } from './plan.state';

import {
  loadPlan,
  loadPlanSuccess,
  loadPlanFailure,
  clearPlanError,
  updatePlan,
} from './plan.actions';

export const initialPlanState: PlanState = {
  plan: null,
  loadingPlan: false,
  error: null,
};

const _planReducer = createReducer(
  initialPlanState,
  on(loadPlan, (state) => ({ ...state, loadingPlan: true, error: null })),
  on(loadPlanSuccess, (state, { plan }) => ({
    ...state,
    plan,
    loadingPlan: false,
  })),
  on(loadPlanFailure, (state, { error }) => ({
    ...state,
    loadingPlan: false,
    error,
  })),
  on(clearPlanError, (state) => ({ ...state, error: null })),
  on(updatePlan, (state, { plan }) => ({ ...state, plan }))
);

export function planReducer(state: PlanState | undefined, action: Action) {
  return _planReducer(state, action);
}
