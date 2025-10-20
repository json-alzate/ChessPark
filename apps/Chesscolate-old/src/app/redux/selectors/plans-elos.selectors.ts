import { createSelector } from '@ngrx/store';

import { getPlansElosState, planElosStateAdapter } from '@redux/states/plans-elos.state';

import { PlanElos } from '@models/planElos.model';

export const {
    selectAll: getAllPlansElos,
    selectTotal: getCountAllPlansElos,
    selectEntities: getPlansElosEntities
} = planElosStateAdapter.getSelectors(getPlansElosState);


// get one planElo
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

