import { bootstrapApplication } from '@angular/platform-browser';
import {
  RouteReuseStrategy,
  provideRouter,
  withPreloading,
  PreloadAllModules,
} from '@angular/router';
import {
  IonicRouteStrategy,
  provideIonicAngular,
} from '@ionic/angular/standalone';
import { provideHttpClient } from '@angular/common/http';

// NgRx
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';

// Transloco
import { TranslocoHttpLoader } from './transloco-loader';
import { provideTransloco } from '@jsverse/transloco';

// State
import { 
  authReducer, 
  AuthEffects, 
  AUTH_SERVICE_TOKEN, 
  PROFILE_SERVICE_TOKEN 
} from '@cpark/state';

// Services
import { AuthService } from './app/services/auth.service';
import { ProfileService } from './app/services/profile.service';

import { register } from 'swiper/element/bundle';
import { importProvidersFrom } from '@angular/core';
register();

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';

if (environment.production) {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('ngsw-worker.js');
    });
  }
}

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(),
    
    // Transloco (antes de los servicios para que puedan usarlo)
    provideTransloco({
      config: {
        availableLangs: ['en', 'es'],
        defaultLang: 'en',
        reRenderOnLangChange: true,
        prodMode: environment.production
      },
      loader: TranslocoHttpLoader
    }),
    
    // Servicios de autenticación (DEBEN estar ANTES de los Effects)
    AuthService,
    ProfileService,
    { provide: AUTH_SERVICE_TOKEN, useExisting: AuthService },
    { provide: PROFILE_SERVICE_TOKEN, useExisting: ProfileService },
    
    // NgRx Store
    provideStore({ 
      auth: authReducer 
    }),
    
    // NgRx Effects (DESPUÉS de proveer los servicios)
    provideEffects([AuthEffects]),
    
    // NgRx DevTools (solo en desarrollo)
    provideStoreDevtools({ 
      maxAge: 25, 
      logOnly: environment.production,
      autoPause: true,
      trace: false,
      traceLimit: 75
    }),
  ],
});
