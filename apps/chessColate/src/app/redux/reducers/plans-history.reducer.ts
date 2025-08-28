import { createReducer, on, Action } from '@ngrx/store';


import { PlansHistoryState, plansHistoryStateAdapter } from '@redux/states/plans-history.state';

import { addPlans, addPlan } from '@redux/actions/plans.actions';

export const initialState: PlansHistoryState = plansHistoryStateAdapter.getInitialState();

export const iplansHistoryReducer = createReducer(
    initialState,
    on(addPlans, (state, { plans }) => plansHistoryStateAdapter.addMany(plans, state)),

    on(addPlan, (state, { plan }) => plansHistoryStateAdapter.addOne(plan, state))
);

export const plansHistoryReducer = (state: PlansHistoryState | undefined, action: Action) => iplansHistoryReducer(state, action);

