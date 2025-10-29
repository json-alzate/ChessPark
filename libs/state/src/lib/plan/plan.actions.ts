import { createAction, props } from '@ngrx/store';

export const loadPlan = createAction('[Plan] Load Plan');

export const loadPlanSuccess = createAction(
  '[Plan] Load Plan Success',
  props<{ data: any }>() // Reemplazar 'any' con el tipo específico
);

export const loadPlanFailure = createAction(
  '[Plan] Load Plan Failure',
  props<{ error: string }>()
);

export const clearPlanError = createAction('[Plan] Clear Error');

export const updatePlan = createAction(
  '[Plan] Update Plan',
  props<{ data: any }>() // Reemplazar 'any' con el tipo específico
);
