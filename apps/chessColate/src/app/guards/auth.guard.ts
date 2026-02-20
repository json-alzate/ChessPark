import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable, of } from 'rxjs';
import { map, filter, take, timeout, catchError, switchMap } from 'rxjs/operators';

import { AppState } from '@cpark/state';
import { getProfile, getIsInitialized } from '@cpark/state';

/**
 * Guard que verifica si el usuario está autenticado.
 * Espera a que la autenticación se inicialice antes de verificar el perfil.
 * Si no hay perfil, bloquea el acceso y redirige a home.
 */
@Injectable({ providedIn: 'root' })
export class AuthGuard {
  private store = inject(Store<AppState>);
  private router = inject(Router);

  canActivate(): Observable<boolean> {
    // Primero esperar a que la autenticación se inicialice
    return this.store.select(getIsInitialized).pipe(
      filter((initialized) => initialized), // Esperar hasta que esté inicializado
      take(1),
      timeout(5000), // Timeout de 5 segundos por si acaso
      // Una vez inicializado, verificar si hay perfil
      switchMap(() => this.store.select(getProfile).pipe(take(1))),
      map((profile) => {
        if (profile?.uid) {
          return true; // Usuario autenticado, permitir acceso
        }
        // Usuario no autenticado, redirigir a home
        this.router.navigate(['/home']);
        return false;
      }),
      catchError(() => {
        // Si hay timeout o error, denegar acceso y redirigir
        this.router.navigate(['/home']);
        return of(false);
      })
    );
  }
}
