import { PlanState, getPlanState } from '../../lib/plan/plan.state';

describe('Plan State', () => {
  let state: PlanState;

  beforeEach(() => {
    state = {
      data: null,

      loadingPlan: false,
      error: null,
    };
  });

  describe('State Structure', () => {
    it('should have the correct structure', () => {
      expect(state).toHaveProperty('data');
      expect(state).toHaveProperty('loadingPlan');
      expect(state).toHaveProperty('error');
    });

    it('should have correct initial values', () => {
      expect(state.data).toBeNull();

      expect(state.loadingPlan).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('Selector', () => {
    it('should return the plan state', () => {
      const result = getPlanState.projector(state);
      expect(result).toBe(state);
    });
  });

  describe('Single Item Operations', () => {
    it('should handle null data initially', () => {
      expect(state.data).toBeNull();
    });

    it('should allow data to be set', () => {
      const mockData = { id: '1', name: 'Test' };
      state.data = mockData;
      expect(state.data).toEqual(mockData);
    });
  });

  describe('Loading State', () => {
    it('should handle loading state changes', () => {
      expect(state.loadingPlan).toBe(false);

      state.loadingPlan = true;
      expect(state.loadingPlan).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle error state changes', () => {
      expect(state.error).toBeNull();

      const errorMessage = 'Test error message';
      state.error = errorMessage;
      expect(state.error).toBe(errorMessage);
    });

    it('should allow error to be cleared', () => {
      state.error = 'Test error';
      expect(state.error).toBe('Test error');

      state.error = null;
      expect(state.error).toBeNull();
    });
  });
});
