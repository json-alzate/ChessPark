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

// Función para crear la aplicación como elemento personalizado (versión mejorada)
async function create<%= classifyName %>ElementEnhanced() {
  try {
    console.log('🚀 Iniciando creación de Angular Elements (Enhanced)...');
    
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
          name: '<%= classifyName %> SDK Widgets (Enhanced)'
        })<% } %>,
      ],
    });

    console.log('✅ Aplicación Angular creada correctamente (Enhanced)');

    const <%= classifyName %>ElementEnhanced = createCustomElement(AppComponent, {
      injector: app.injector,
    });

    // Registrar el elemento personalizado
    customElements.define('<%= name %>-app-enhanced', <%= classifyName %>ElementEnhanced);
    
    console.log('✅ Elemento personalizado <%= name %>-app-enhanced registrado correctamente');
    
    // Inicializar el router después de que el elemento esté registrado
    setTimeout(async () => {
      try {
        const router = app.injector.get(Router);
        console.log('🔄 Inicializando router (Enhanced)...');
        
        // Navegar a la ruta inicial
        await router.navigate(['/']);
        console.log('✅ Router inicializado y navegando a / (Enhanced)');
        
        // Verificar que las rutas estén cargadas
        console.log('📋 Rutas disponibles (Enhanced):', routes.map(r => r.path));
        
        // Configuración adicional para la versión mejorada
        console.log('🔧 Configuración mejorada activada');
        
      } catch (routerError) {
        console.error('❌ Error al inicializar router (Enhanced):', routerError);
      }
    }, 500);
    
    // Disparar un evento personalizado para notificar que está listo
    window.dispatchEvent(new CustomEvent('<%= name %>-app-enhanced-ready'));
    
    // Verificar que el elemento se haya registrado correctamente
    setTimeout(() => {
      const element = customElements.get('<%= name %>-app-enhanced');
      if (element) {
        console.log('✅ Elemento personalizado verificado (Enhanced):', element);
      } else {
        console.error('❌ Elemento personalizado no encontrado después del registro (Enhanced)');
      }
    }, 100);
    
    // Funcionalidades adicionales para la versión mejorada
    console.log('🚀 Funcionalidades mejoradas activadas');
    
  } catch (error) {
    console.error('❌ Error al crear el elemento personalizado (Enhanced):', error);
  }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', create<%= classifyName %>ElementEnhanced);
} else {
  create<%= classifyName %>ElementEnhanced();
}
