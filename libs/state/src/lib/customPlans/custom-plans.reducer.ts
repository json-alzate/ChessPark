import { createReducer, on, Action } from '@ngrx/store';
import {
  CustomPlansState,
  customPlansStateAdapter,
} from './custom-plans.state';
import {
  loadCustomPlans,
  addCustomPlans,
  addOneCustomPlan,
  updateCustomPlan,
} from './custom-plans.actions';

export const initialCustomPlansState: CustomPlansState =
  customPlansStateAdapter.getInitialState({ loading: false });

const _customPlansReducer = createReducer(
  initialCustomPlansState,
  on(loadCustomPlans, (state) => ({ ...state, loading: true })),
  on(addCustomPlans, (state, { plans }) => ({
    ...customPlansStateAdapter.addMany(plans, state),
    loading: false,
  })),
  on(addOneCustomPlan, (state, { plan }) =>
    customPlansStateAdapter.addOne(plan, state)
  ),
  on(updateCustomPlan, (state, { plan }) =>
    customPlansStateAdapter.updateOne(plan, state)
  )
);

export function customPlansReducer(
  state: CustomPlansState | undefined,
  action: Action
) {
  return _customPlansReducer(state, action);
}
