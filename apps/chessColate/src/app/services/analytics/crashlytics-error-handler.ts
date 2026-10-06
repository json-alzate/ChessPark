import { ErrorHandler, Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { FirebaseCrashlytics } from '@capacitor-firebase/crashlytics';

import { environment } from '@environments/environment';

/**
 * ErrorHandler global de Angular que reporta los errores JS no capturados a
 * Firebase Crashlytics como excepciones no fatales (non-fatals).
 *
 * - Siempre mantiene el `console.error` (comportamiento por defecto de Angular
 *   en desarrollo).
 * - Crashlytics es SOLO nativo (Android/iOS): en web es un no-op silencioso.
 * - Todo el reporte es defensivo: si el plugin falla, nunca rompe el flujo.
 *
 * Los crashes nativos no capturados los recoge el SDK automáticamente; este
 * handler cubre los errores de la capa JS/Angular.
 */
@Injectable()
export class CrashlyticsErrorHandler implements ErrorHandler {

  handleError(error: unknown): void {
    // Mantener el comportamiento por defecto (visible en dev y en logcat).
    console.error(error);

    // Crashlytics no tiene implementación web → no-op.
    if (!Capacitor.isNativePlatform() || !environment.crashlyticsEnabled) {
      return;
    }

    const message = this.extractMessage(error);
    // No usamos await: el reporte no debe bloquear el ciclo de error.
    FirebaseCrashlytics.recordException({ message }).catch((reportError) => {
      console.warn('[Crashlytics] recordException falló:', reportError);
    });
  }

  private extractMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.stack ?? error.message;
    }
    return typeof error === 'string' ? error : JSON.stringify(error);
  }
}
