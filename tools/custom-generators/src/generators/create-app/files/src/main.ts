import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';

<% if (hasNgRx) { %>import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';

import { UIEvents } from '@xerpa/core-functions';

import { sdkReducers, } from '@xerpa/state';
import { UIEffects } from '@xerpa/state/effects';<% } %>

import { defineCustomElements } from '@xerpa/ui/loader';
defineCustomElements();

<% if (hasSwiper) { %>import { register } from 'swiper/element/bundle';
register();<% } %>

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';

<% if (hasServiceWorker) { %>if (environment.production) {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('ngsw-worker.js');
    });
  }
}<% } %>

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules))<% if (hasNgRx) { %>,
    provideStore(sdkReducers),
    provideEffects([UIEffects]),
    UIEvents,
    provideStoreDevtools({
      maxAge: 25,
      logOnly: false,
      name: '<%= classifyName %> SDK Widgets'
    })<% } %>,
  ],
});
