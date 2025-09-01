import { createCustomElement } from '@angular/elements';
import { createApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules, Router } from '@angular/router';
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

// Función para crear la aplicación como elemento personalizado
async function create<%= classifyName %>Element() {
  try {
    console.log('🚀 Iniciando creación de Angular Elements...');
    
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
          name: '<%= classifyName %> SDK Widgets'
        })<% } %>,
      ],
    });

    console.log('✅ Aplicación Angular creada correctamente');

    const <%= classifyName %>Element = createCustomElement(AppComponent, {
      injector: app.injector,
    });

    // Registrar el elemento personalizado
    customElements.define('<%= name %>-app', <%= classifyName %>Element);
    
    console.log('✅ Elemento personalizado <%= name %>-app registrado correctamente');
    
    // Inicializar el router después de que el elemento esté registrado
    setTimeout(async () => {
      try {
        const router = app.injector.get(Router);
        console.log('🔄 Inicializando router...');
        
        // Navegar a la ruta inicial
        await router.navigate(['/']);
        console.log('✅ Router inicializado y navegando a /');
        
        // Verificar que las rutas estén cargadas
        console.log('📋 Rutas disponibles:', routes.map(r => r.path));
        
      } catch (routerError) {
        console.error('❌ Error al inicializar router:', routerError);
      }
    }, 500);
    
    // Disparar un evento personalizado para notificar que está listo
    window.dispatchEvent(new CustomEvent('<%= name %>-app-ready'));
    
    // Verificar que el elemento se haya registrado correctamente
    setTimeout(() => {
      const element = customElements.get('<%= name %>-app');
      if (element) {
        console.log('✅ Elemento personalizado verificado:', element);
      } else {
        console.error('❌ Elemento personalizado no encontrado después del registro');
      }
    }, 100);
    
  } catch (error) {
    console.error('❌ Error al crear el elemento personalizado:', error);
  }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', create<%= classifyName %>Element);
} else {
  create<%= classifyName %>Element();
}
