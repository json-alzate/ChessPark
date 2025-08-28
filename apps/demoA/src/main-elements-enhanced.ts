import { createCustomElement } from '@angular/elements';
import { createApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules, Router } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';

import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';

import { UIEvents } from '@xerpa/core-functions';

import { sdkReducers } from '@xerpa/state';
import { UIEffects } from '@xerpa/state/effects';

import { defineCustomElements } from '@xerpa/ui/loader';
defineCustomElements();

import { register } from 'swiper/element/bundle';
register();

import { routes } from './app/app.routes';
import { AppComponentEnhanced } from './app/app.component-enhanced';

// Función para crear la aplicación como elemento personalizado con router mejorado
async function createDemoAElementEnhanced() {
  try {
    console.log('🚀 Iniciando creación de Angular Elements Enhanced...');
    
    // Configurar base href si no existe
    if (!document.querySelector('base[href]')) {
      const base = document.createElement('base');
      base.href = '/';
      document.head.appendChild(base);
      console.log('✅ Base href configurado');
    }
    
    const app = await createApplication({
      providers: [
        { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
        provideIonicAngular(),
        provideRouter(routes, withPreloading(PreloadAllModules)),
        provideStore(sdkReducers),
        provideEffects([UIEffects]),
        UIEvents,
        provideStoreDevtools({
          maxAge: 25,
          logOnly: false,
          name: 'Xerpa SDK Widgets'
        })
      ],
    });

    console.log('✅ Aplicación Angular Enhanced creada correctamente');

    const DemoAElement = createCustomElement(AppComponentEnhanced, {
      injector: app.injector,
    });

    // Registrar el elemento personalizado
    customElements.define('demo-a-app-enhanced', DemoAElement);
    
    console.log('✅ Elemento personalizado demo-a-app-enhanced registrado correctamente');
    
    // Inicializar el router después de que el elemento esté registrado
    setTimeout(async () => {
      try {
        const router = app.injector.get(Router);
        console.log('🔄 Inicializando router enhanced...');
        
        // Esperar a que el router esté listo
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Navegar a la ruta inicial
        await router.navigate(['/']);
        console.log('✅ Router enhanced inicializado y navegando a /');
        
        // Verificar que las rutas estén cargadas
        console.log('📋 Rutas disponibles:', routes.map(r => r.path));
        
        // Verificar el estado del router
        console.log('📍 Ruta actual:', router.url);
        
      } catch (routerError) {
        console.error('❌ Error al inicializar router enhanced:', routerError);
      }
    }, 500);
    
    // Disparar un evento personalizado para notificar que está listo
    window.dispatchEvent(new CustomEvent('demo-a-app-enhanced-ready'));
    
    // Verificar que el elemento se haya registrado correctamente
    setTimeout(() => {
      const element = customElements.get('demo-a-app-enhanced');
      if (element) {
        console.log('✅ Elemento personalizado enhanced verificado:', element);
      } else {
        console.error('❌ Elemento personalizado enhanced no encontrado después del registro');
      }
    }, 100);
    
  } catch (error) {
    console.error('❌ Error al crear el elemento personalizado enhanced:', error);
  }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createDemoAElementEnhanced);
} else {
  createDemoAElementEnhanced();
} 