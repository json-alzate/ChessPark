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

// Función para crear la aplicación como elemento personalizado
async function createMiNuevaAppElement() {
  try {
    console.log('🚀 Iniciando creación de Angular Elements...');

    const app = await createApplication({
      providers: [
        { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
        provideIonicAngular(),
        provideRouter(routes, withPreloading(PreloadAllModules)),
      ],
    });

    console.log('✅ Aplicación Angular creada correctamente');

    const MiNuevaAppElement = createCustomElement(AppComponent, {
      injector: app.injector,
    });

    // Registrar el elemento personalizado
    customElements.define('mi-nueva-app-app', MiNuevaAppElement);

    console.log(
      '✅ Elemento personalizado mi-nueva-app-app registrado correctamente'
    );

    // Inicializar el router después de que el elemento esté registrado
    setTimeout(async () => {
      try {
        const router = app.injector.get(Router);
        console.log('🔄 Inicializando router...');

        // Navegar a la ruta inicial
        await router.navigate(['/']);
        console.log('✅ Router inicializado y navegando a /');

        // Verificar que las rutas estén cargadas
        console.log(
          '📋 Rutas disponibles:',
          routes.map((r) => r.path)
        );
      } catch (routerError) {
        console.error('❌ Error al inicializar router:', routerError);
      }
    }, 500);

    // Disparar un evento personalizado para notificar que está listo
    window.dispatchEvent(new CustomEvent('mi-nueva-app-app-ready'));

    // Verificar que el elemento se haya registrado correctamente
    setTimeout(() => {
      const element = customElements.get('mi-nueva-app-app');
      if (element) {
        console.log('✅ Elemento personalizado verificado:', element);
      } else {
        console.error(
          '❌ Elemento personalizado no encontrado después del registro'
        );
      }
    }, 100);
  } catch (error) {
    console.error('❌ Error al crear el elemento personalizado:', error);
  }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createMiNuevaAppElement);
} else {
  createMiNuevaAppElement();
}
