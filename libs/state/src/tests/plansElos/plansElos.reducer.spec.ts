import { PlansElosState } from '../../lib/plansElos/plansElos.state';

// TODO: Importar el modelo cuando se cree
// import { XerpaPlansElos } from '@xerpa/models';
interface XerpaPlansElos {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

import {
  loadPlansElos,
  loadPlansElosSuccess,
  loadPlansElosFailure,
  clearPlansElosError,
  addPlansElos,
  updatePlansElos,
  deletePlansElos,
} from '../../lib/plansElos/plansElos.actions';
import {
  plansElosReducer,
  initialPlansElosState,
} from '../../lib/plansElos/plansElos.reducer';

describe('PlansElos Reducer', () => {
  let initialState: PlansElosState;

  beforeEach(() => {
    initialState = { ...initialPlansElosState };
  });

  it('should return the initial state', () => {
    const action = { type: 'unknown' };
    const state = plansElosReducer(undefined, action);
    expect(state).toEqual(initialPlansElosState);
  });

  it('should handle loadPlansElos', () => {
    const action = loadPlansElos();
    const state = plansElosReducer(initialState, action);
    expect(state.loadingPlansElos).toBe(true);
    expect(state.error).toBe(null);
  });

  it('should handle loadPlansElosSuccess', () => {
    const plansElos: XerpaPlansElos[] = [
      {
        id: '1',
        name: 'Test PlansElos',
        description: 'Test',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const action = loadPlansElosSuccess({ plansElos });
    const state = plansElosReducer(initialState, action);
    expect(state.plansElos).toEqual(plansElos);
    expect(state.loadingPlansElos).toBe(false);
  });

  it('should handle loadPlansElosFailure', () => {
    const error = 'Error message';
    const action = loadPlansElosFailure({ error });
    const state = plansElosReducer(initialState, action);
    expect(state.error).toBe(error);
    expect(state.loadingPlansElos).toBe(false);
  });

  it('should handle clearPlansElosError', () => {
    initialState.error = 'Some error';
    const action = clearPlansElosError();
    const state = plansElosReducer(initialState, action);
    expect(state.error).toBe(null);
  });

  it('should handle addPlansElos', () => {
    const newPlansElos: XerpaPlansElos = {
      id: '2',
      name: 'New PlansElos',
      description: 'New',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const action = addPlansElos({ plansElos: newPlansElos });
    const state = plansElosReducer(initialState, action);
    expect(state.plansElos).toContain(newPlansElos);
  });

  it('should handle updatePlansElos', () => {
    initialState.plansElos = [
      {
        id: '1',
        name: 'Original',
        description: 'Original',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const updatedPlansElos: XerpaPlansElos = {
      id: '1',
      name: 'Updated',
      description: 'Updated',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const action = updatePlansElos({ plansElos: updatedPlansElos });
    const state = plansElosReducer(initialState, action);
    expect(state.plansElos.find((item) => item.id === '1')).toEqual(
      updatedPlansElos
    );
  });

  it('should handle deletePlansElos', () => {
    initialState.plansElos = [
      {
        id: '1',
        name: 'To Delete',
        description: 'To Delete',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const action = deletePlansElos({ id: '1' });
    const state = plansElosReducer(initialState, action);
    expect(state.plansElos.length).toBe(0);
    expect(state.plansElos.find((item) => item.id === '1')).toBeUndefined();
  });
});
