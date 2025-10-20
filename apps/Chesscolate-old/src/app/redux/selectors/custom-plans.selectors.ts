import { createSelector } from '@ngrx/store';

import { getCustomPlansState, customPlansStateAdapter } from '@redux/states/custom-plans.state';

import { Plan } from '@models/plan.model';

export const {
    selectAll: getAllCustomPlans,
    selectTotal: getCountAllCustomPlans,
    selectEntities: getCustomPlansEntities
} = customPlansStateAdapter.getSelectors(getCustomPlansState);


// get one custom plan
export const getPlanCustomPlan = (uidCustomPlan: string) => createSelector(
    getAllCustomPlans,
    (customPlans: Plan[]) => {
        if (customPlans) {
            return customPlans.find(customPlan => customPlan.uid === uidCustomPlan) || null;
        } else {
            return null;
        }
    }
);


export const getCustomPlansOrderByDate = createSelector(
    getAllCustomPlans,
    (plans) => plans.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
);
