import { TestBed } from '@angular/core/testing';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { PlansElosFacadeService } from '../../lib/plansElos/plansElos-facade.service';
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
  clearPlansElosError,
  addPlansElos,
  updatePlansElos,
  deletePlansElos,
} from '../../lib/plansElos/plansElos.actions';

describe('PlansElosFacadeService', () => {
  let service: PlansElosFacadeService;
  let store: MockStore<PlansElosState>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PlansElosFacadeService,
        provideMockStore({
          initialState: {
            plansElos: [],
            loadingPlansElos: false,
            error: null,
          },
        }),
      ],
    });

    service = TestBed.inject(PlansElosFacadeService);
    store = TestBed.inject(MockStore);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should dispatch loadPlansElos', () => {
    const spy = jest.spyOn(store, 'dispatch');
    service.loadPlansElos();
    expect(spy).toHaveBeenCalledWith(loadPlansElos());
  });

  it('should dispatch clearPlansElosError', () => {
    const spy = jest.spyOn(store, 'dispatch');
    service.clearError();
    expect(spy).toHaveBeenCalledWith(clearPlansElosError());
  });

  it('should dispatch addPlansElos', () => {
    const plansElos: XerpaPlansElos = {
      id: '1',
      name: 'Test PlansElos',
      description: 'Test',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const spy = jest.spyOn(store, 'dispatch');
    service.addPlansElos(plansElos);
    expect(spy).toHaveBeenCalledWith(addPlansElos({ plansElos }));
  });

  it('should dispatch updatePlansElos', () => {
    const plansElos: XerpaPlansElos = {
      id: '1',
      name: 'Updated PlansElos',
      description: 'Updated',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const spy = jest.spyOn(store, 'dispatch');
    service.updatePlansElos(plansElos);
    expect(spy).toHaveBeenCalledWith(updatePlansElos({ plansElos }));
  });

  it('should dispatch deletePlansElos', () => {
    const id = '1';
    const spy = jest.spyOn(store, 'dispatch');
    service.deletePlansElos(id);
    expect(spy).toHaveBeenCalledWith(deletePlansElos({ id }));
  });

  // Nota: Las pruebas de selectores se pueden agregar aquí si es necesario
  // Dependiendo de la implementación específica del facade
});
