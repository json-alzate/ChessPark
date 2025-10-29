import { PlanState } from '../../lib/plan/plan.state';

import {
  getPlanData,
  getPlanLoading,
  getPlanError,
} from '../../lib/plan/plan.selectors';

describe('Plan Selectors', () => {
  let mockState: PlanState;

  beforeEach(() => {
    mockState = {
      data: { id: '1', name: 'Test Plan' },
      loadingPlan: false,
      error: null,
    };
  });

  it('should select plan data', () => {
    const result = getPlanData.projector(mockState);
    expect(result).toEqual(mockState.data);
  });

  it('should select loading state', () => {
    const result = getPlanLoading.projector(mockState);
    expect(result).toBe(false);
  });

  it('should select error state', () => {
    const result = getPlanError.projector(mockState);
    expect(result).toBe(null);
  });

  it('should handle loading state', () => {
    mockState.loadingPlan = true;
    const result = getPlanLoading.projector(mockState);
    expect(result).toBe(true);
  });

  it('should handle error state', () => {
    mockState.error = 'Error message';
    const result = getPlanError.projector(mockState);
    expect(result).toBe('Error message');
  });
});
