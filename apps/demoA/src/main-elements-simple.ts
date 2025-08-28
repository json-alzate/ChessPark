import { createCustomElement } from '@angular/elements';
import { createApplication } from '@angular/platform-browser';
import { provideIonicAngular } from '@ionic/angular/standalone';

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

import { AppComponentSimple } from './app/app.component-simple';

// Función para crear la aplicación como elemento personalizado (sin router)
async function createDemoAElementSimple() {
  try {
    console.log('🚀 Iniciando creación de Angular Elements (versión simple)...');
    
    const app = await createApplication({
      providers: [
        provideIonicAngular(),
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

    console.log('✅ Aplicación Angular (simple) creada correctamente');

    const DemoAElement = createCustomElement(AppComponentSimple, {
      injector: app.injector,
    });

    // Registrar el elemento personalizado
    customElements.define('demo-a-app-simple', DemoAElement);
    
    console.log('✅ Elemento personalizado demo-a-app-simple registrado correctamente');
    
    // Disparar un evento personalizado para notificar que está listo
    window.dispatchEvent(new CustomEvent('demo-a-app-simple-ready'));
    
    // Verificar que el elemento se haya registrado correctamente
    setTimeout(() => {
      const element = customElements.get('demo-a-app-simple');
      if (element) {
        console.log('✅ Elemento personalizado simple verificado:', element);
      } else {
        console.error('❌ Elemento personalizado simple no encontrado después del registro');
      }
    }, 100);
    
  } catch (error) {
    console.error('❌ Error al crear el elemento personalizado simple:', error);
  }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createDemoAElementSimple);
} else {
  createDemoAElementSimple();
} 