import { PlanState } from '../../lib/plan/plan.state';

import {
  loadPlan,
  loadPlanSuccess,
  loadPlanFailure,
  clearPlanError,
  updatePlan,
} from '../../lib/plan/plan.actions';
import { planReducer, initialPlanState } from '../../lib/plan/plan.reducer';

describe('Plan Reducer', () => {
  let initialState: PlanState;

  beforeEach(() => {
    initialState = { ...initialPlanState };
  });

  it('should return the initial state', () => {
    const action = { type: 'unknown' };
    const state = planReducer(undefined, action);
    expect(state).toEqual(initialPlanState);
  });

  it('should handle loadPlan', () => {
    const action = loadPlan();
    const state = planReducer(initialState, action);
    expect(state.loadingPlan).toBe(true);
    expect(state.error).toBe(null);
  });

  it('should handle loadPlanSuccess', () => {
    const data = { id: '1', name: 'Test Plan' };
    const action = loadPlanSuccess({ data });
    const state = planReducer(initialState, action);
    expect(state.data).toEqual(data);
  });

  it('should handle loadPlanFailure', () => {
    const error = 'Error message';
    const action = loadPlanFailure({ error });
    const state = planReducer(initialState, action);
    expect(state.error).toBe(error);
    expect(state.loadingPlan).toBe(false);
  });

  it('should handle clearPlanError', () => {
    initialState.error = 'Some error';
    const action = clearPlanError();
    const state = planReducer(initialState, action);
    expect(state.error).toBe(null);
  });

  it('should handle updatePlan', () => {
    const data = { id: '1', name: 'Updated Plan' };
    const action = updatePlan({ data });
    const state = planReducer(initialState, action);
    expect(state.data).toEqual(data);
  });
});
