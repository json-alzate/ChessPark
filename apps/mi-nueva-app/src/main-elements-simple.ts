import { createCustomElement } from '@angular/elements';
import { createApplication } from '@angular/platform-browser';
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

import { defineCustomElements } from '@xerpa/ui/loader';
defineCustomElements();

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';

// Función para crear la aplicación como elemento personalizado (versión simple)
async function createMiNuevaAppElementSimple() {
  try {
    console.log('🚀 Iniciando creación de Angular Elements (Simple)...');

    const app = await createApplication({
      providers: [
        { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
        provideIonicAngular(),
        provideRouter(routes, withPreloading(PreloadAllModules)),
      ],
    });

    console.log('✅ Aplicación Angular creada correctamente (Simple)');

    const MiNuevaAppElementSimple = createCustomElement(AppComponent, {
      injector: app.injector,
    });

    // Registrar el elemento personalizado
    customElements.define('mi-nueva-app-app-simple', MiNuevaAppElementSimple);

    console.log(
      '✅ Elemento personalizado mi-nueva-app-app-simple registrado correctamente'
    );

    // Disparar un evento personalizado para notificar que está listo
    window.dispatchEvent(new CustomEvent('mi-nueva-app-app-simple-ready'));
  } catch (error) {
    console.error(
      '❌ Error al crear el elemento personalizado (Simple):',
      error
    );
  }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createMiNuevaAppElementSimple);
} else {
  createMiNuevaAppElementSimple();
}
