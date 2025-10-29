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
  data: null,
  loadingPlan: false,
  error: null,
};

const _planReducer = createReducer(
  initialPlanState,
  on(loadPlan, (state) => ({ ...state, loadingPlan: true, error: null })),
  on(loadPlanSuccess, (state, { data }) => ({
    ...state,
    data,
    loadingPlan: false,
  })),
  on(loadPlanFailure, (state, { error }) => ({
    ...state,
    loadingPlan: false,
    error,
  })),
  on(clearPlanError, (state) => ({ ...state, error: null })),
  on(updatePlan, (state, { data }) => ({ ...state, data }))
);

export function planReducer(state: PlanState | undefined, action: Action) {
  return _planReducer(state, action);
}
