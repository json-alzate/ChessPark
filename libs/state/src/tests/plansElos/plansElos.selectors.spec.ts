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
  getPlansElos,
  getPlansElosById,
  getPlansElosCount,
  getPlansElosLoading,
  getPlansElosError,
} from '../../lib/plansElos/plansElos.selectors';

describe('PlansElos Selectors', () => {
  let mockState: PlansElosState;

  beforeEach(() => {
    mockState = {
      plansElos: [
        {
          id: '1',
          name: 'Test PlansElos 1',
          description: 'Test 1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          name: 'Test PlansElos 2',
          description: 'Test 2',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      loadingPlansElos: false,
      error: null,
    };
  });

  it('should select plansElos', () => {
    const result = getPlansElos.projector(mockState);
    expect(result).toEqual(mockState.plansElos);
  });

  it('should select plansElos by id', () => {
    const result = getPlansElosById('1').projector(mockState);
    expect(result).toEqual(mockState.plansElos[0]);
  });

  it('should select plansElos count', () => {
    const result = getPlansElosCount.projector(mockState);
    expect(result).toBe(2);
  });

  it('should return undefined for non-existent id', () => {
    const result = getPlansElosById('999').projector(mockState);
    expect(result).toBeUndefined();
  });

  it('should select loading state', () => {
    const result = getPlansElosLoading.projector(mockState);
    expect(result).toBe(false);
  });

  it('should select error state', () => {
    const result = getPlansElosError.projector(mockState);
    expect(result).toBe(null);
  });

  it('should handle loading state', () => {
    mockState.loadingPlansElos = true;
    const result = getPlansElosLoading.projector(mockState);
    expect(result).toBe(true);
  });

  it('should handle error state', () => {
    mockState.error = 'Error message';
    const result = getPlansElosError.projector(mockState);
    expect(result).toBe('Error message');
  });
});
