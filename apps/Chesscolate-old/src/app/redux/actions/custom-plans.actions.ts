import { createAction, props } from '@ngrx/store';


import { Plan } from '@models/plan.model';
import { Update } from '@ngrx/entity';


export const requestGetCustomPlans = createAction(
    '[CustomPlans] requestGetCustomPlans',
    props<{ uidUser: string }>()
);


export const addCustomPlans = createAction(
    '[CustomPlans] addCustomPlans',
    props<{ customPlans: Plan[] }>()
);

export const requestAddOneCustomPlan = createAction(
    '[CustomPlans] requestAddOneCustomPlan',
    props<{ customPlan: Plan }>()
);

export const addOneCustomPlan = createAction(
    '[CustomPlans] addOneCustomPlan',
    props<{ customPlan: Plan }>()
);

export const requestUpdateCustomPlan = createAction(
    '[CustomPlans] requestUpdateCustomPlan',
    props<{ customPlan: Plan }>()
);

export const updateCustomPlan = createAction(
    '[CustomPlans] updateCustomPlan',
    props<{ customPlan: Update<Plan> }>()
);
