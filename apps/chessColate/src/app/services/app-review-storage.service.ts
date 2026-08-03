import { Injectable } from '@angular/core';

import { AppReviewState, DEFAULT_APP_REVIEW_STATE } from './app-review.util';

/**
 * Persistencia local de la invitación a calificar la app: contadores de uso y
 * fecha de la última petición. Todo en localStorage, como el resto del estado
 * local de la app (ver TrainingReminderStorageService).
 */
@Injectable({
  providedIn: 'root',
})
export class AppReviewStorageService {
  private readonly STATE_KEY = 'chessColate_app_review_state';

  getState(): AppReviewState {
    try {
      const json = localStorage.getItem(this.STATE_KEY);
      if (!json) {
        return { ...DEFAULT_APP_REVIEW_STATE };
      }
      // Merge con defaults para tolerar estados guardados por versiones previas
      return { ...DEFAULT_APP_REVIEW_STATE, ...JSON.parse(json) };
    } catch (error) {
      console.error('Error al leer el estado de la reseña:', error);
      return { ...DEFAULT_APP_REVIEW_STATE };
    }
  }

  saveState(state: AppReviewState): void {
    try {
      localStorage.setItem(this.STATE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Error al guardar el estado de la reseña:', error);
    }
  }
}
