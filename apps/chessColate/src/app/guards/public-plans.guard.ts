import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { combineLatest, of } from 'rxjs';
import { filter, take, switchMap } from 'rxjs/operators';

import { AppState } from '@cpark/state';
import { getProfile, getIsInitialized } from '@cpark/state';
import { PublicPlansFacadeService } from '@cpark/state';

/**
 * Guard para la ruta de planes públicos.
 * Permite el acceso siempre, pero carga planes públicos e interacciones del usuario
 * si está autenticado.
 */
@Injectable({ providedIn: 'root' })
export class PublicPlansGuard {
  private store = inject(Store<AppState>);
  private publicPlansFacade = inject(PublicPlansFacadeService);

  canActivate() {
    // Esperar a que la autenticación se inicialice
    this.store.select(getIsInitialized)
      .pipe(
        filter((initialized) => initialized),
        take(1),
        switchMap(() => this.store.select(getProfile).pipe(take(1)))
      )
      .subscribe((profile) => {
        // Cargar planes públicos iniciales (primeros 20)
        this.publicPlansFacade.loadPublicPlans('recent', 20);
        
        // Si el usuario está autenticado, cargar sus interacciones
        if (profile?.uid) {
          this.publicPlansFacade.loadUserInteractions(profile.uid);
        }
      });

    // Siempre permitir acceso
    return of(true);
  }
}
