import { Injectable } from '@angular/core';

import {
  DEFAULT_TRAINING_REMINDER_STATE,
  MAX_STORED_EVENTS,
  TrainingEvent,
  TrainingReminderState,
} from './training-reminder.util';

/**
 * Persistencia local del recordatorio de entrenamiento: estado del
 * recordatorio y horas de las últimas sesiones. Todo en localStorage,
 * como el resto del estado local de la app (ver PlanStorageService).
 */
@Injectable({
  providedIn: 'root',
})
export class TrainingReminderStorageService {
  private readonly STATE_KEY = 'chessColate_training_reminder_state';
  private readonly EVENTS_KEY = 'chessColate_training_events';

  getState(): TrainingReminderState {
    try {
      const json = localStorage.getItem(this.STATE_KEY);
      if (!json) {
        return { ...DEFAULT_TRAINING_REMINDER_STATE };
      }
      // Merge con defaults para tolerar estados guardados por versiones previas
      return { ...DEFAULT_TRAINING_REMINDER_STATE, ...JSON.parse(json) };
    } catch (error) {
      console.error('Error al leer el estado del recordatorio:', error);
      return { ...DEFAULT_TRAINING_REMINDER_STATE };
    }
  }

  saveState(patch: Partial<TrainingReminderState>): TrainingReminderState {
    const state = { ...this.getState(), ...patch };
    try {
      localStorage.setItem(this.STATE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Error al guardar el estado del recordatorio:', error);
    }
    return state;
  }

  getEvents(): TrainingEvent[] {
    try {
      const json = localStorage.getItem(this.EVENTS_KEY);
      if (!json) {
        return [];
      }
      const events = JSON.parse(json);
      return Array.isArray(events) ? events : [];
    } catch (error) {
      console.error('Error al leer los eventos de entrenamiento:', error);
      return [];
    }
  }

  /** Añade un evento conservando solo los MAX_STORED_EVENTS más recientes. */
  addEvent(event: TrainingEvent): void {
    const events = [...this.getEvents(), event]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_STORED_EVENTS);
    try {
      localStorage.setItem(this.EVENTS_KEY, JSON.stringify(events));
    } catch (error) {
      console.error('Error al guardar el evento de entrenamiento:', error);
    }
  }
}
