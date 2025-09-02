import { createReducer, on, Action } from '@ngrx/store';

import { Plan } from '@models/plan.model';

import { setPlan } from '@redux/actions/plans.actions';




export const iplanReducer = createReducer(
    null,

    on(setPlan, (state, { plan }) => plan)

);

export const planReducer = (state: Plan | undefined, action: Action) => iplanReducer(state, action);
