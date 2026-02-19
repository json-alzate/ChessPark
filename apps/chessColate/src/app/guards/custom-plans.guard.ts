import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { combineLatest, of } from 'rxjs';
import { filter, take, switchMap } from 'rxjs/operators';

import { AppState } from '@cpark/state';
import { getCountAllCustomPlans, getProfile, getIsInitialized, loadCustomPlans } from '@cpark/state';
import { PlansElosFacadeService } from '@cpark/state';

/**
 * Guard para la ruta de listado de planes personalizados.
 * Permite el acceso siempre (para mostrar mensaje de login si no hay autenticación),
 * pero solo carga planes si el usuario está autenticado.
 */
@Injectable({ providedIn: 'root' })
export class CustomPlansGuard {
  private store = inject(Store<AppState>);
  private plansElosFacade = inject(PlansElosFacadeService);

  canActivate() {
    // Esperar a que la autenticación se inicialice
    this.store.select(getIsInitialized)
      .pipe(
        filter((initialized) => initialized),
        take(1),
        switchMap(() => this.store.select(getProfile).pipe(take(1)))
      )
      .subscribe((profile) => {
        // Solo cargar planes y elos si el usuario está autenticado
        if (profile?.uid) {
          this.plansElosFacade.requestLoadPlansElos(profile.uid);

          // Cargar planes si no hay ninguno cargado
          combineLatest([
            this.store.select(getCountAllCustomPlans),
            this.store.select(getProfile),
          ])
            .pipe(
              filter(([count, p]) => count === 0 && !!p?.uid),
              take(1)
            )
            .subscribe(([, p]) => {
              if (p?.uid) {
                this.store.dispatch(loadCustomPlans({ uidUser: p.uid }));
              }
            });
        }
      });

    // Siempre permitir acceso al listado (el componente mostrará mensaje de login si no hay auth)
    return of(true);
  }
}
