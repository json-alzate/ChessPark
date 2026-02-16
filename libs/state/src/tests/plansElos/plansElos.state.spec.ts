import {
  PlansElosState,
  getPlansElosState,
} from '../../lib/plansElos/plansElos.state';

describe('PlansElos State', () => {
  let state: PlansElosState;

  beforeEach(() => {
    state = {
      plansElos: [],

      loadingPlansElos: false,
      error: null,
    };
  });

  describe('State Structure', () => {
    it('should have the correct structure', () => {
      expect(state).toHaveProperty('plansElos');
      expect(state).toHaveProperty('loadingPlansElos');
      expect(state).toHaveProperty('error');
    });

    it('should have correct initial values', () => {
      expect(state.plansElos).toEqual([]);

      expect(state.loadingPlansElos).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('Selector', () => {
    it('should return the plansElos state', () => {
      const result = getPlansElosState.projector(state);
      expect(result).toBe(state);
    });
  });

  describe('List Operations', () => {
    it('should handle empty plansElos list', () => {
      expect(state.plansElos.length).toBe(0);
    });

    it('should allow plansElos to be populated', () => {
      const mockPlansElos = [{ id: '1', name: 'Test' }];
      state.plansElos = mockPlansElos;
      expect(state.plansElos).toEqual(mockPlansElos);
    });
  });

  describe('Loading State', () => {
    it('should handle loading state changes', () => {
      expect(state.loadingPlansElos).toBe(false);

      state.loadingPlansElos = true;
      expect(state.loadingPlansElos).toBe(true);
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
