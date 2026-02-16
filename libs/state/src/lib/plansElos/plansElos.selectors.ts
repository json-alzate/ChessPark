import { createSelector } from '@ngrx/store';
import { getPlansElosState, planElosStateAdapter } from './plansElos.state';
import { PlanElos } from '@cpark/models';

export const {
  selectAll: getAllPlansElos,
  selectTotal: getCountAllPlansElos,
  selectEntities: getPlansElosEntities
} = planElosStateAdapter.getSelectors(getPlansElosState);

// get one planElo by uidPlan
export const getPlanElo = (uidPlan: string) => createSelector(
  getAllPlansElos,
  (plansElos: PlanElos[]) => {
    if (plansElos) {
      return plansElos.find(planElo => planElo.uidPlan === uidPlan) || null;
    } else {
      return null;
    }
  }
);
