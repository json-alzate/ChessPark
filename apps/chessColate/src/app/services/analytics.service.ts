import { Injectable } from '@angular/core';
import { FirebaseAnalytics } from '@capacitor-firebase/analytics';

import { environment } from '@environments/environment';

/**
 * Nombres de eventos de negocio (GA4). Unión cerrada en snake_case para
 * mantener el catálogo consistente y evitar eventos duplicados/tipeados mal.
 */
export type AnalyticsEventName =
  | 'routine_started'
  | 'puzzle_started'
  | 'puzzle_completed'
  | 'reto333_finished'
  | 'coordinates_started'
  | 'coordinates_completed'
  | 'knight_tour_started'
  | 'knight_tour_completed'
  | 'chess960_position_changed'
  | 'custom_plan_created'
  | 'custom_plan_updated'
  | 'public_plan_saved'
  | 'language_changed'
  | 'donation_completed'
  | 'training_reminder_prompt_shown'
  | 'training_reminder_enabled'
  | 'training_reminder_disabled'
  | 'training_reminder_scheduled'
  | 'training_reminder_time_changed'
  | 'training_reminder_tapped';

/** Valores primitivos admitidos por GA4 como parámetros de evento. */
export type AnalyticsParams = Record<string, string | number | boolean>;

/**
 * Fachada única de analítica (Firebase Analytics / GA4).
 *
 * Toda la instrumentación de la app pasa por aquí — los componentes nunca
 * llaman al plugin directamente. Así se puede cambiar de proveedor sin tocar
 * el resto de la app.
 *
 * - Funciona igual en web y nativo (Analytics tiene implementación web vía
 *   el SDK de Firebase, que ya se inicializa en `AppComponent.initFirebase`).
 * - Todas las llamadas son defensivas (`try/catch`): la analítica nunca debe
 *   romper un flujo de usuario.
 * - Gateado por `environment.analyticsEnabled` (desactivado en dev).
 */
@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {

  /** Habilita/deshabilita la recolección a nivel del SDK. */
  async setEnabled(enabled: boolean): Promise<void> {
    try {
      await FirebaseAnalytics.setEnabled({ enabled });
    } catch (error) {
      console.warn('[Analytics] setEnabled falló:', error);
    }
  }

  /** Registra un evento de negocio con parámetros opcionales. */
  async logEvent(name: AnalyticsEventName, params?: AnalyticsParams): Promise<void> {
    if (!environment.analyticsEnabled) {
      return;
    }
    try {
      await FirebaseAnalytics.logEvent({ name, params });
    } catch (error) {
      console.warn(`[Analytics] logEvent(${name}) falló:`, error);
    }
  }

  /**
   * Registra la pantalla actual (nombre ya legible). Necesario en una SPA:
   * GA4 no capta los cambios de ruta dentro de una sola Activity/ViewController.
   */
  async logScreenView(screenName: string): Promise<void> {
    if (!environment.analyticsEnabled) {
      return;
    }
    try {
      await FirebaseAnalytics.setCurrentScreen({ screenName });
    } catch (error) {
      console.warn('[Analytics] setCurrentScreen falló:', error);
    }
  }

  /**
   * Asocia los eventos con el usuario. Usar SIEMPRE el UID de Firebase,
   * nunca el email u otro PII. `null` para desasociar al cerrar sesión.
   */
  async setUserId(userId: string | null): Promise<void> {
    try {
      await FirebaseAnalytics.setUserId({ userId });
    } catch (error) {
      console.warn('[Analytics] setUserId falló:', error);
    }
  }

  /** Define una user property para segmentación. */
  async setUserProperty(key: string, value: string | null): Promise<void> {
    if (!environment.analyticsEnabled) {
      return;
    }
    try {
      await FirebaseAnalytics.setUserProperty({ key, value });
    } catch (error) {
      console.warn(`[Analytics] setUserProperty(${key}) falló:`, error);
    }
  }
}
