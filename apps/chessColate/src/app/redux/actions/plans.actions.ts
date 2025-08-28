import { createAction, props } from '@ngrx/store';

import { Plan } from '@models/plan.model';


export const setPlan = createAction(
    '[PLAN] setPlan',
    props<{ plan: Plan }>()
);

export const requestSavePlan = createAction(
    '[PLAN] requestSavePlan',
    props<{ plan: Plan }>()
);

export const addPlan = createAction(
    '[PLAN] addPlan',
    props<{ plan: Plan }>()
);

export const requestGetPlans = createAction(
    '[PLAN] requestGetPlans',
    props<{ uidUser: string }>()
);


export const addPlans = createAction(
    '[PLAN] addPlans',
    props<{ plans: Plan[] }>()
);
