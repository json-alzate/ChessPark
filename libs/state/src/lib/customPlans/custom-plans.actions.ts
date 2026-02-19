import { createAction, props } from '@ngrx/store';
import { Plan } from '@cpark/models';
import { Update } from '@ngrx/entity';

export const loadCustomPlans = createAction(
  '[CustomPlans] Load Custom Plans',
  props<{ uidUser: string }>()
);

export const addCustomPlans = createAction(
  '[CustomPlans] Add Custom Plans',
  props<{ plans: Plan[] }>()
);

export const addOneCustomPlan = createAction(
  '[CustomPlans] Add One Custom Plan',
  props<{ plan: Plan }>()
);

export const updateCustomPlan = createAction(
  '[CustomPlans] Update Custom Plan',
  props<{ plan: Update<Plan> }>()
);
