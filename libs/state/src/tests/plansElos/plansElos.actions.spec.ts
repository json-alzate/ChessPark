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

describe('PlansElos Actions', () => {
  it('should create loadPlansElos action', () => {
    const action = loadPlansElos();
    expect(action.type).toBe('[PlansElos] Load PlansElos');
  });

  it('should create loadPlansElosSuccess action', () => {
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
    expect(action.type).toBe('[PlansElos] Load PlansElos Success');
    expect(action.plansElos).toEqual(plansElos);
  });

  it('should create loadPlansElosFailure action', () => {
    const error = 'Error message';
    const action = loadPlansElosFailure({ error });
    expect(action.type).toBe('[PlansElos] Load PlansElos Failure');
    expect(action.error).toBe(error);
  });

  it('should create clearPlansElosError action', () => {
    const action = clearPlansElosError();
    expect(action.type).toBe('[PlansElos] Clear Error');
  });

  it('should create addPlansElos action', () => {
    const plansElos: XerpaPlansElos = {
      id: '1',
      name: 'New PlansElos',
      description: 'New',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const action = addPlansElos({ plansElos });
    expect(action.type).toBe('[PlansElos] Add PlansElos');
    expect(action.plansElos).toEqual(plansElos);
  });

  it('should create updatePlansElos action', () => {
    const plansElos: XerpaPlansElos = {
      id: '1',
      name: 'Updated PlansElos',
      description: 'Updated',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const action = updatePlansElos({ plansElos });
    expect(action.type).toBe('[PlansElos] Update PlansElos');
    expect(action.plansElos).toEqual(plansElos);
  });

  it('should create deletePlansElos action', () => {
    const id = '1';
    const action = deletePlansElos({ id });
    expect(action.type).toBe('[PlansElos] Delete PlansElos');
    expect(action.id).toBe(id);
  });
});
