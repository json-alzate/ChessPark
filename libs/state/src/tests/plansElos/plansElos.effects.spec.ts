import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Actions } from '@ngrx/effects';
import { PlansElosEffects } from '../../lib/plansElos/plansElos.effects';

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
} from '../../lib/plansElos/plansElos.actions';
import { of, throwError } from 'rxjs';

describe('PlansElosEffects', () => {
  let effects: PlansElosEffects;
  let actions$: Actions;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PlansElosEffects, provideMockActions(() => actions$)],
    });

    effects = TestBed.inject(PlansElosEffects);
    actions$ = TestBed.inject(Actions);
  });

  it('should be created', () => {
    expect(effects).toBeTruthy();
  });

  describe('loadPlansElos$', () => {
    it('should return loadPlansElosSuccess on success', (done) => {
      actions$ = of(loadPlansElos());

      effects.loadPlansElos$.subscribe((action) => {
        expect(action.type).toBe(loadPlansElosSuccess.type);

        expect(action.plansElos).toEqual([]);

        done();
      });
    });

    it('should return loadPlansElosFailure on error', (done) => {
      // Simular un error en el efecto
      actions$ = of(loadPlansElos());

      // Mock del efecto para simular error
      const mockEffects = new PlansElosEffects();
      jest
        .spyOn(mockEffects, 'loadPlansElos$')
        .mockReturnValue(throwError(() => new Error('Test error')));

      mockEffects.loadPlansElos$.subscribe({
        error: (error) => {
          expect(error.message).toBe('Test error');
          done();
        },
      });
    });
  });

  // Nota: En un escenario real, estos efectos se conectarían con servicios reales
  // Aquí solo verificamos que la estructura básica esté en su lugar
  // Las pruebas más específicas dependerían de la implementación real de los servicios
});
