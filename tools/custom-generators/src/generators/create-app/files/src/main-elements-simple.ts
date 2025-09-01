import { createCustomElement } from '@angular/elements';
import { createApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';

<% if (hasNgRx) { %>import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';

import { UIEvents } from '@xerpa/core-functions';

import { sdkReducers } from '@xerpa/state';
import { UIEffects } from '@xerpa/state/effects';<% } %>

import { defineCustomElements } from '@xerpa/ui/loader';
defineCustomElements();

<% if (hasSwiper) { %>import { register } from 'swiper/element/bundle';
register();<% } %>

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';

// Función para crear la aplicación como elemento personalizado (versión simple)
async function create<%= classifyName %>ElementSimple() {
  try {
    console.log('🚀 Iniciando creación de Angular Elements (Simple)...');
    
    const app = await createApplication({
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
          name: '<%= classifyName %> SDK Widgets (Simple)'
        })<% } %>,
      ],
    });

    console.log('✅ Aplicación Angular creada correctamente (Simple)');

    const <%= classifyName %>ElementSimple = createCustomElement(AppComponent, {
      injector: app.injector,
    });

    // Registrar el elemento personalizado
    customElements.define('<%= name %>-app-simple', <%= classifyName %>ElementSimple);
    
    console.log('✅ Elemento personalizado <%= name %>-app-simple registrado correctamente');
    
    // Disparar un evento personalizado para notificar que está listo
    window.dispatchEvent(new CustomEvent('<%= name %>-app-simple-ready'));
    
  } catch (error) {
    console.error('❌ Error al crear el elemento personalizado (Simple):', error);
  }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', create<%= classifyName %>ElementSimple);
} else {
  create<%= classifyName %>ElementSimple();
}
