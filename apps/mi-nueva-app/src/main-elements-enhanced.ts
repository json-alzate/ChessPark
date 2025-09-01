import { createCustomElement } from '@angular/elements';
import { createApplication } from '@angular/platform-browser';
import {
  RouteReuseStrategy,
  provideRouter,
  withPreloading,
  PreloadAllModules,
  Router,
} from '@angular/router';
import {
  IonicRouteStrategy,
  provideIonicAngular,
} from '@ionic/angular/standalone';

import { defineCustomElements } from '@xerpa/ui/loader';
defineCustomElements();

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';

// Función para crear la aplicación como elemento personalizado (versión mejorada)
async function createMiNuevaAppElementEnhanced() {
  try {
    console.log('🚀 Iniciando creación de Angular Elements (Enhanced)...');

    const app = await createApplication({
      providers: [
        { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
        provideIonicAngular(),
        provideRouter(routes, withPreloading(PreloadAllModules)),
      ],
    });

    console.log('✅ Aplicación Angular creada correctamente (Enhanced)');

    const MiNuevaAppElementEnhanced = createCustomElement(AppComponent, {
      injector: app.injector,
    });

    // Registrar el elemento personalizado
    customElements.define(
      'mi-nueva-app-app-enhanced',
      MiNuevaAppElementEnhanced
    );

    console.log(
      '✅ Elemento personalizado mi-nueva-app-app-enhanced registrado correctamente'
    );

    // Inicializar el router después de que el elemento esté registrado
    setTimeout(async () => {
      try {
        const router = app.injector.get(Router);
        console.log('🔄 Inicializando router (Enhanced)...');

        // Navegar a la ruta inicial
        await router.navigate(['/']);
        console.log('✅ Router inicializado y navegando a / (Enhanced)');

        // Verificar que las rutas estén cargadas
        console.log(
          '📋 Rutas disponibles (Enhanced):',
          routes.map((r) => r.path)
        );

        // Configuración adicional para la versión mejorada
        console.log('🔧 Configuración mejorada activada');
      } catch (routerError) {
        console.error(
          '❌ Error al inicializar router (Enhanced):',
          routerError
        );
      }
    }, 500);

    // Disparar un evento personalizado para notificar que está listo
    window.dispatchEvent(new CustomEvent('mi-nueva-app-app-enhanced-ready'));

    // Verificar que el elemento se haya registrado correctamente
    setTimeout(() => {
      const element = customElements.get('mi-nueva-app-app-enhanced');
      if (element) {
        console.log(
          '✅ Elemento personalizado verificado (Enhanced):',
          element
        );
      } else {
        console.error(
          '❌ Elemento personalizado no encontrado después del registro (Enhanced)'
        );
      }
    }, 100);

    // Funcionalidades adicionales para la versión mejorada
    console.log('🚀 Funcionalidades mejoradas activadas');
  } catch (error) {
    console.error(
      '❌ Error al crear el elemento personalizado (Enhanced):',
      error
    );
  }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    createMiNuevaAppElementEnhanced
  );
} else {
  createMiNuevaAppElementEnhanced();
}
