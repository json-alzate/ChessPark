import { createReducer, on, Action } from '@ngrx/store';


import { CustomPlansState, customPlansStateAdapter } from '@redux/states/custom-plans.state';

import { addOneCustomPlan, updateCustomPlan, addCustomPlans } from '@redux/actions/custom-plans.actions';

export const initialState: CustomPlansState = customPlansStateAdapter.getInitialState();

export const icustomPlansReducer = createReducer(
    initialState,
    on(addOneCustomPlan, (state, { customPlan }) => customPlansStateAdapter.addOne(customPlan, state)),

    on(updateCustomPlan, (state, { customPlan }) => customPlansStateAdapter.updateOne(customPlan, state)),

    on(addCustomPlans, (state, { customPlans }) => customPlansStateAdapter.addMany(customPlans, state))
);

export const customPlansReducer = (state: CustomPlansState | undefined, action: Action) => icustomPlansReducer(state, action);
