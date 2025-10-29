import { createSelector } from '@ngrx/store';
import { getPlanState } from './plan.state';

export const getPlanData = createSelector(
  getPlanState,
  (planState) => planState.plan || null
);

export const getPlanLoading = createSelector(
  getPlanState,
  (planState) => planState.loadingPlan
);

export const getPlanError = createSelector(
  getPlanState,
  (planState) => planState.error
);
