import { createSelector } from '@ngrx/store';
import {
  getCustomPlansState,
  customPlansStateAdapter,
} from './custom-plans.state';
import { Plan } from '@cpark/models';

export const {
  selectAll: getAllCustomPlans,
  selectTotal: getCountAllCustomPlans,
  selectEntities: getCustomPlansEntities,
} = customPlansStateAdapter.getSelectors(getCustomPlansState);

export const getCustomPlan = (uid: string) =>
  createSelector(getAllCustomPlans, (plans: Plan[]) => {
    if (!plans) return null;
    return plans.find((p) => p.uid === uid) ?? null;
  });

export const getCustomPlansOrderByDate = createSelector(
  getAllCustomPlans,
  (plans) =>
    [...(plans ?? [])].sort(
      (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)
    )
);
