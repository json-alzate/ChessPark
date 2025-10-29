import { PlanState } from '../../lib/plan/plan.state';

import {
  loadPlan,
  loadPlanSuccess,
  loadPlanFailure,
  clearPlanError,
  updatePlan,
} from '../../lib/plan/plan.actions';

describe('Plan Actions', () => {
  it('should create loadPlan action', () => {
    const action = loadPlan();
    expect(action.type).toBe('[Plan] Load Plan');
  });

  it('should create loadPlanSuccess action', () => {
    const data = { id: '1', name: 'Test Plan' };
    const action = loadPlanSuccess({ data });
    expect(action.type).toBe('[Plan] Load Plan Success');
    expect(action.data).toEqual(data);
  });

  it('should create loadPlanFailure action', () => {
    const error = 'Error message';
    const action = loadPlanFailure({ error });
    expect(action.type).toBe('[Plan] Load Plan Failure');
    expect(action.error).toBe(error);
  });

  it('should create clearPlanError action', () => {
    const action = clearPlanError();
    expect(action.type).toBe('[Plan] Clear Error');
  });

  it('should create updatePlan action', () => {
    const data = { id: '1', name: 'Updated Plan' };
    const action = updatePlan({ data });
    expect(action.type).toBe('[Plan] Update Plan');
    expect(action.data).toEqual(data);
  });
});
