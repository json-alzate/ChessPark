import { importProvidersFrom } from '@angular/core';
import { TranslocoTestingModule } from '@jsverse/transloco';

/**
 * Transloco para pruebas de componentes: sin red ni archivos de idioma.
 *
 * Con el diccionario vacío, el pipe `transloco` devuelve la propia clave, así que
 * una prueba puede comprobar qué texto se pintó (`'HOME.title'`) sin acoplarse a la
 * traducción. Si necesita un texto concreto, lo pasa en `es`.
 */
export function provideTranslocoTesting(es: Record<string, unknown> = {}) {
  return importProvidersFrom(
    TranslocoTestingModule.forRoot({
      langs: { es },
      translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
      preloadLangs: true,
    }),
  );
}
