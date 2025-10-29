import { createAction, props } from '@ngrx/store';

import { Plan } from '@cpark/models';
export const loadPlan = createAction('[Plan] Load Plan');

export const loadPlanSuccess = createAction(
  '[Plan] Load Plan Success',
  props<{ plan: Plan }>()
);

export const loadPlanFailure = createAction(
  '[Plan] Load Plan Failure',
  props<{ error: string }>()
);

export const clearPlanError = createAction('[Plan] Clear Error');

export const updatePlan = createAction(
  '[Plan] Update Plan',
  props<{ plan: Plan }>()
);
