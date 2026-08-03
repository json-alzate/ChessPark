import { inject, Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { InAppReview } from '@capacitor-community/in-app-review';

import { AnalyticsService } from './analytics.service';
import { AppReviewStorageService } from './app-review-storage.service';
import {
  registerRoutine,
  resolveTrigger,
  markRequested,
  RoutineOutcome,
} from './app-review.util';

/** Identificador de la app en las tiendas. */
const APP_ID = 'com.jheison.chesscolate';
/** Ficha en la Play Store (esquema nativo y fallback web). */
const PLAY_STORE_APP_URL = `market://details?id=${APP_ID}`;
const PLAY_STORE_WEB_URL = `https://play.google.com/store/apps/details?id=${APP_ID}`;

/** Margen para que el usuario respire el resultado antes de que salga la tarjeta. */
const REQUEST_DELAY_MS = 800;

/**
 * Fachada única de la invitación a calificar la app.
 *
 * Los componentes nunca llaman al plugin directamente: solo avisan de que
 * terminó una rutina y cómo fue, y aquí se decide si toca pedir la reseña.
 *
 * - Toda la lógica de "cuándo" es nuestra (ver `app-review.util`): el API de
 *   Google no admite pre-prompts ni incentivos, y ni siquiera informa de si el
 *   usuario acabó calificando.
 * - Solo en nativo: en web el plugin no hace nada y llamarlo gastaría el
 *   cooldown de 90 días para nada.
 * - Defensiva de principio a fin: pedir una reseña jamás debe romper el final
 *   de una rutina.
 */
@Injectable({
  providedIn: 'root',
})
export class AppReviewService {
  private storage = inject(AppReviewStorageService);
  private analytics = inject(AnalyticsService);

  /**
   * Se llama al terminar una rutina, con el resultado a la vista. Actualiza
   * los contadores y, si toca, muestra la tarjeta nativa de la tienda.
   *
   * `canPrompt` en false solo suma al contador: sirve para cuando la pantalla
   * de resultados ya está mostrando otro aviso (p. ej. el del recordatorio) y
   * no conviene encadenar dos.
   */
  async onRoutineFinished(
    planUid: string,
    outcome: RoutineOutcome,
    canPrompt = true
  ): Promise<void> {
    const now = new Date();
    const previous = this.storage.getState();
    const state = registerRoutine(previous, planUid, now);

    if (state === previous) {
      // Este plan ya se contó (p. ej. se volvió a la pantalla de resultados).
      return;
    }
    this.storage.saveState(state);

    if (!canPrompt || !Capacitor.isNativePlatform()) {
      return;
    }

    const trigger = resolveTrigger(state, outcome, now);
    if (!trigger) {
      return;
    }

    await this.delay(REQUEST_DELAY_MS);

    try {
      await InAppReview.requestReview();
    } catch (error) {
      console.warn('[AppReview] requestReview falló:', error);
    }

    // Se marca aunque el sistema no llegue a mostrar la tarjeta: no hay forma
    // de saberlo, y reintentar en la siguiente rutina sería insistir a ciegas.
    this.storage.saveState(markRequested(state, now));

    void this.analytics.logEvent('app_review_requested', {
      trigger,
      completed_routines: state.completedRoutines,
    });
  }

  /**
   * Botón "Califícanos" de Ajustes: abre la ficha de la tienda. No pasa por el
   * API nativo, así que no tiene cuota ni cooldown.
   */
  openStoreListing(): void {
    void this.analytics.logEvent('app_review_store_opened');

    const isAndroid = Capacitor.getPlatform() === 'android';
    const url =
      Capacitor.isNativePlatform() && isAndroid
        ? PLAY_STORE_APP_URL
        : PLAY_STORE_WEB_URL;

    try {
      window.open(url, '_blank');
    } catch (error) {
      console.warn('[AppReview] No se pudo abrir la ficha de la tienda:', error);
      window.open(PLAY_STORE_WEB_URL, '_blank');
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
