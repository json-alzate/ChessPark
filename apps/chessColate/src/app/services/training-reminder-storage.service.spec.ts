import { TrainingReminderStorageService } from './training-reminder-storage.service';
import {
  DEFAULT_TRAINING_REMINDER_STATE,
  MAX_STORED_EVENTS,
} from './training-reminder.util';

describe('TrainingReminderStorageService', () => {
  let service: TrainingReminderStorageService;

  beforeEach(() => {
    localStorage.clear();
    service = new TrainingReminderStorageService();
  });

  it('devuelve los defaults con localStorage vacío', () => {
    expect(service.getState()).toEqual(DEFAULT_TRAINING_REMINDER_STATE);
    expect(service.getEvents()).toEqual([]);
  });

  it('devuelve los defaults sin lanzar con JSON corrupto', () => {
    localStorage.setItem('chessColate_training_reminder_state', '{corrupto');
    localStorage.setItem('chessColate_training_events', 'no-es-json');
    expect(service.getState()).toEqual(DEFAULT_TRAINING_REMINDER_STATE);
    expect(service.getEvents()).toEqual([]);
  });

  it('persiste parches de estado y los mergea con los defaults', () => {
    service.saveState({ enabled: true, suggestedHour: 21 });
    expect(service.getState()).toEqual({
      ...DEFAULT_TRAINING_REMINDER_STATE,
      enabled: true,
      suggestedHour: 21,
    });
  });

  it('limita los eventos guardados a los más recientes', () => {
    for (let i = 0; i < MAX_STORED_EVENTS + 10; i++) {
      service.addEvent({ timestamp: i, hourLocal: 20, minuteLocal: 0 });
    }
    const events = service.getEvents();
    expect(events).toHaveLength(MAX_STORED_EVENTS);
    // Conserva los más recientes (timestamps altos)
    expect(events[0].timestamp).toBe(MAX_STORED_EVENTS + 9);
    expect(events[events.length - 1].timestamp).toBe(10);
  });
});
