import { TestBed } from '@angular/core/testing';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { PlanFacadeService } from '../../lib/plan/plan-facade.service';
import { PlanState } from '../../lib/plan/plan.state';

import {
  loadPlan,
  clearPlanError,
  updatePlan,
} from '../../lib/plan/plan.actions';

describe('PlanFacadeService', () => {
  let service: PlanFacadeService;
  let store: MockStore<PlanState>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PlanFacadeService,
        provideMockStore({
          initialState: {
            data: null,
            loadingPlan: false,
            error: null,
          },
        }),
      ],
    });

    service = TestBed.inject(PlanFacadeService);
    store = TestBed.inject(MockStore);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should dispatch loadPlan', () => {
    const spy = jest.spyOn(store, 'dispatch');
    service.loadPlan();
    expect(spy).toHaveBeenCalledWith(loadPlan());
  });

  it('should dispatch clearPlanError', () => {
    const spy = jest.spyOn(store, 'dispatch');
    service.clearError();
    expect(spy).toHaveBeenCalledWith(clearPlanError());
  });

  it('should dispatch updatePlan', () => {
    const data = { id: '1', name: 'Updated Plan' };
    const spy = jest.spyOn(store, 'dispatch');
    service.updatePlan(data);
    expect(spy).toHaveBeenCalledWith(updatePlan({ data }));
  });

  // Nota: Las pruebas de selectores se pueden agregar aquí si es necesario
  // Dependiendo de la implementación específica del facade
});
