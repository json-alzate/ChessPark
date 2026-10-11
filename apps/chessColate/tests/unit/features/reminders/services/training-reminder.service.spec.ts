import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { TranslocoService } from '@jsverse/transloco';

import { UidGeneratorService } from '@chesspark/common-utils';
import { Plan } from '@chesspark/models';

import { AnalyticsService } from '@core/analytics/analytics.service';
import { PlanStorageService } from '@services/plans/plan-storage.service';
import {
  ManualReminder,
  MAX_MANUAL_REMINDERS,
} from '@features/reminders/models/reminder.model';
import { TrainingReminderService } from '@features/reminders/services/training-reminder.service';
import { TrainingReminderStorageService } from '@features/reminders/services/training-reminder-storage.service';
import { toLocalISODate } from '@shared/utils/date.util';

jest.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    addListener: jest.fn(),
    createChannel: jest.fn(),
    checkPermissions: jest.fn(),
    requestPermissions: jest.fn(),
    schedule: jest.fn(),
    cancel: jest.fn(),
    getPending: jest.fn(),
  },
}));

jest.mock('@capacitor/app', () => ({
  App: { addListener: jest.fn() },
}));

/** Ids fijos del servicio (ver constantes del archivo). */
const AUTO_IDS = [741001, 741002, 741003];
const TEST_ID = 741999;
const MANUAL_BASE = 742000;

/** "Ahora" de las pruebas: sábado 10-oct-2026, 15:00 hora local. */
const NOW = new Date(2026, 9, 10, 15, 0, 0, 0);

const at = (dayOffset: number, hour: number, minute = 0) =>
  new Date(2026, 9, 10 + dayOffset, hour, minute, 0, 0);

const plan = (createdAt: number, planType = 'plan5'): Plan =>
  ({ createdAt, planType } as unknown as Plan);

const manual = (overrides: Partial<ManualReminder> = {}): ManualReminder => ({
  id: 'm1',
  seq: 0,
  hour: 7,
  minute: 30,
  weekdays: [],
  label: 'Mis tácticas',
  enabled: true,
  ...overrides,
});

/** Transloco falso: devuelve la clave y, si hay parámetros, los añade para poder comprobarlos. */
const translate = (key: string, params?: Record<string, unknown>) =>
  params ? `${key}|${JSON.stringify(params)}` : key;

const flush = async () => {
  for (let i = 0; i < 6; i++) {
    await Promise.resolve();
  }
};

describe('TrainingReminderService', () => {
  let service: TrainingReminderService;
  let storage: TrainingReminderStorageService;
  let isNative: jest.SpyInstance;
  let platform: jest.SpyInstance;

  const router = { navigate: jest.fn() };
  const analytics = { logEvent: jest.fn() };
  const planStorage = { getAllPlans: jest.fn() };
  const uidGenerator = { generateSimpleUid: jest.fn() };

  const ln = LocalNotifications as unknown as Record<string, jest.Mock>;
  const appPlugin = App as unknown as { addListener: jest.Mock };

  /** Permiso que reporta el SO; mutable dentro de cada prueba. */
  let osPermission: 'granted' | 'denied' | 'prompt';
  /** Notificaciones que el SO tiene pendientes. */
  let pending: Array<{ id: number; schedule?: { at?: Date } }>;

  /** Crea el servicio; el flag nativo se lee al construirse, así que va después de fijar el entorno. */
  const createService = (native: boolean, platformName = 'android') => {
    isNative.mockReturnValue(native);
    platform.mockReturnValue(platformName);
    service = TestBed.inject(TrainingReminderService);
  };

  const scheduleCalls = () => ln['schedule'].mock.calls.map(([arg]) => arg.notifications);
  const lastScheduled = () => {
    const calls = scheduleCalls();
    return calls[calls.length - 1];
  };
  const eventsLogged = () => analytics.logEvent.mock.calls.map(([name]) => name);

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    jest.clearAllMocks();
    localStorage.clear();
    osPermission = 'granted';
    pending = [];

    isNative = jest.spyOn(Capacitor, 'isNativePlatform');
    platform = jest.spyOn(Capacitor, 'getPlatform');
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    ln['addListener'].mockResolvedValue({ remove: jest.fn() });
    ln['createChannel'].mockResolvedValue(undefined);
    ln['checkPermissions'].mockImplementation(async () => ({ display: osPermission }));
    ln['requestPermissions'].mockImplementation(async () => {
      if (osPermission === 'prompt') {
        osPermission = 'granted';
      }
      return { display: osPermission };
    });
    ln['schedule'].mockResolvedValue({ notifications: [] });
    ln['cancel'].mockResolvedValue(undefined);
    ln['getPending'].mockImplementation(async () => ({ notifications: pending }));
    appPlugin.addListener.mockResolvedValue({ remove: jest.fn() });
    analytics.logEvent.mockResolvedValue(undefined);
    planStorage.getAllPlans.mockReturnValue([]);
    uidGenerator.generateSimpleUid.mockReturnValue('uid-nuevo');

    TestBed.configureTestingModule({
      providers: [
        TrainingReminderService,
        { provide: Router, useValue: router },
        { provide: TranslocoService, useValue: { translate } },
        { provide: AnalyticsService, useValue: analytics },
        { provide: PlanStorageService, useValue: planStorage },
        { provide: UidGeneratorService, useValue: uidGenerator },
      ],
    });
    storage = TestBed.inject(TrainingReminderStorageService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('en web (sin plataforma nativa)', () => {
    beforeEach(() => createService(false, 'web'));

    it('init no registra listeners ni agenda nada', async () => {
      await service.init();

      expect(ln['addListener']).not.toHaveBeenCalled();
      expect(appPlugin.addListener).not.toHaveBeenCalled();
      expect(ln['schedule']).not.toHaveBeenCalled();
    });

    it('reschedule, onSessionStarted y los manuales no tocan el plugin', async () => {
      storage.saveState({ enabled: true, permissionGranted: true });
      storage.saveManualReminders([manual()]);

      await service.reschedule();
      service.onSessionStarted();
      await flush();
      await service.toggleManualReminder('m1', true);

      expect(ln['schedule']).not.toHaveBeenCalled();
      expect(ln['cancel']).not.toHaveBeenCalled();
      expect(ln['getPending']).not.toHaveBeenCalled();
    });

    it('checkPermissionStatus responde denied sin consultar al SO', async () => {
      expect(await service.checkPermissionStatus()).toBe('denied');
      expect(ln['checkPermissions']).not.toHaveBeenCalled();
    });

    it('la notificación de prueba no se envía', async () => {
      expect(await service.sendTestNotification()).toBe(false);
      expect(ln['schedule']).not.toHaveBeenCalled();
    });
  });

  describe('init (nativo)', () => {
    it('registra el listener de toque y el de volver a la app', async () => {
      createService(true);

      await service.init();

      expect(ln['addListener']).toHaveBeenCalledWith(
        'localNotificationActionPerformed',
        expect.any(Function)
      );
      expect(appPlugin.addListener).toHaveBeenCalledWith('resume', expect.any(Function));
    });

    it('en Android crea el canal con el nombre traducido', async () => {
      createService(true, 'android');

      await service.init();

      expect(ln['createChannel']).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'training-reminder', name: 'TRAINING_REMINDER.channelName' })
      );
    });

    it('en iOS no crea canal', async () => {
      createService(true, 'ios');

      await service.init();

      expect(ln['createChannel']).not.toHaveBeenCalled();
    });

    it('al arrancar reprograma el automático y los manuales activados', async () => {
      storage.saveState({ enabled: true, permissionGranted: true });
      storage.saveManualReminders([manual()]);
      createService(true);

      await service.init();

      const sent = scheduleCalls();
      expect(sent).toHaveLength(2);
      expect(sent[0].map((n: { id: number }) => n.id)).toEqual(AUTO_IDS);
      expect(sent[1].map((n: { id: number }) => n.id)).toEqual([MANUAL_BASE]);
    });

    it('migra el historial de planes a eventos de hora antes de reprogramar', async () => {
      planStorage.getAllPlans.mockReturnValue([plan(at(-1, 9, 10).getTime())]);
      createService(true);

      await service.init();

      expect(storage.getEvents()).toEqual([
        { timestamp: at(-1, 9, 10).getTime(), hourLocal: 9, minuteLocal: 10 },
      ]);
    });

    it('si algo falla al arrancar no lanza', async () => {
      ln['addListener'].mockRejectedValue(new Error('plugin ausente'));
      createService(true);

      await expect(service.init()).resolves.toBeUndefined();
    });

    describe('toque en una notificación', () => {
      const tap = async (extra: unknown) => {
        await service.init();
        const handler = ln['addListener'].mock.calls[0][1];
        handler({ notification: { extra } });
      };

      it('del recordatorio automático: registra el toque con la racha y abre el home', async () => {
        // Entrenó los 3 días anteriores: racha de 3 en juego hoy
        planStorage.getAllPlans.mockReturnValue([
          plan(at(-1, 20).getTime()),
          plan(at(-2, 20).getTime()),
          plan(at(-3, 20).getTime()),
        ]);
        createService(true);

        await tap({ source: 'training_reminder' });

        expect(analytics.logEvent).toHaveBeenCalledWith('training_reminder_tapped', {
          streak_days: 3,
        });
        expect(router.navigate).toHaveBeenCalledWith(['/home']);
      });

      it('de otra fuente (no nuestra) se ignora', async () => {
        createService(true);

        await tap({ source: 'otra_app' });

        expect(router.navigate).not.toHaveBeenCalled();
        expect(eventsLogged()).not.toContain('training_reminder_tapped');
      });

      it('sin datos extra se ignora', async () => {
        createService(true);

        await tap(undefined);

        expect(router.navigate).not.toHaveBeenCalled();
      });

      // La documentación dice "al tocar la notificación se abre el home" y los
      // manuales llevan source 'training_reminder_manual', que el listener descarta.
      it.skip('BUG: tocar un recordatorio manual debería abrir el home', async () => {
        createService(true);

        await tap({ source: 'training_reminder_manual', reminderId: 'm1' });

        expect(router.navigate).toHaveBeenCalledWith(['/home']);
      });
    });

    it('al volver de segundo plano reprograma', async () => {
      storage.saveState({ enabled: true, permissionGranted: true });
      createService(true);
      await service.init();
      ln['schedule'].mockClear();

      const onResume = appPlugin.addListener.mock.calls[0][1];
      onResume();
      await flush();

      expect(ln['schedule']).toHaveBeenCalledTimes(1);
    });
  });

  describe('consultas de estado', () => {
    beforeEach(() => createService(true));

    it('getEventsCount migra el historial la primera vez y cuenta los eventos', () => {
      planStorage.getAllPlans.mockReturnValue([
        plan(at(-1, 8).getTime()),
        plan(at(-2, 8).getTime()),
      ]);

      expect(service.getEventsCount()).toBe(2);
    });

    it('getSuggestedTime parte del historial de planes y redondea a la media hora', () => {
      planStorage.getAllPlans.mockReturnValue([plan(at(-1, 9, 51).getTime())]);

      expect(service.getSuggestedTime()).toEqual({ hour: 10, minute: 0, confident: false });
    });

    it('sin historial sugiere las 20:00 sin confianza', () => {
      expect(service.getSuggestedTime()).toEqual({ hour: 20, minute: 0, confident: false });
    });

    it('markContextPromptShown guarda cuándo se mostró el modal', () => {
      service.markContextPromptShown();

      expect(service.getState().contextPromptShownAt).toBe(NOW.getTime());
    });

    it('checkPermissionStatus devuelve el estado del SO', async () => {
      osPermission = 'prompt';

      expect(await service.checkPermissionStatus()).toBe('prompt');
    });

    it('checkPermissionStatus responde denied si el plugin falla', async () => {
      ln['checkPermissions'].mockRejectedValue(new Error('x'));

      expect(await service.checkPermissionStatus()).toBe('denied');
    });
  });

  describe('migración del historial de planes', () => {
    beforeEach(() => createService(true));

    it('no migra si ya hay eventos registrados', () => {
      storage.addEvent({ timestamp: at(-1, 7).getTime(), hourLocal: 7, minuteLocal: 0 });
      planStorage.getAllPlans.mockReturnValue([plan(at(-2, 22).getTime())]);

      service.getEventsCount();

      expect(storage.getEvents()).toHaveLength(1);
    });

    it('marca como último día entrenado el del plan más reciente', () => {
      planStorage.getAllPlans.mockReturnValue([
        plan(at(-5, 8).getTime()),
        plan(at(-2, 8).getTime()),
        plan(at(-9, 8).getTime()),
      ]);

      service.getEventsCount();

      expect(service.getState().lastTrainedDate).toBe(toLocalISODate(at(-2, 8)));
    });

    it('no pisa un último día entrenado que ya existiera', () => {
      storage.saveState({ lastTrainedDate: '2026-10-09' });
      planStorage.getAllPlans.mockReturnValue([plan(at(-5, 8).getTime())]);

      service.getEventsCount();

      expect(service.getState().lastTrainedDate).toBe('2026-10-09');
    });

    it('si el almacén de planes falla, se tolera como historial vacío', () => {
      planStorage.getAllPlans.mockImplementation(() => {
        throw new Error('localStorage corrupto');
      });

      expect(service.getEventsCount()).toBe(0);
    });
  });

  describe('reschedule (recordatorio automático)', () => {
    beforeEach(() => {
      createService(true);
      storage.saveState({ enabled: true, permissionGranted: true });
    });

    it('si está desactivado solo cancela lo pendiente', async () => {
      storage.saveState({ enabled: false, scheduledNotificationIds: AUTO_IDS });

      await service.reschedule();

      expect(ln['cancel']).toHaveBeenCalledWith({ notifications: AUTO_IDS.map((id) => ({ id })) });
      expect(ln['schedule']).not.toHaveBeenCalled();
      expect(storage.getState().scheduledNotificationIds).toEqual([]);
    });

    it('si el SO niega el permiso, lo refleja en el estado, cancela y no agenda', async () => {
      osPermission = 'denied';

      await service.reschedule();

      expect(storage.getState().permissionGranted).toBe(false);
      expect(ln['cancel']).toHaveBeenCalled();
      expect(ln['schedule']).not.toHaveBeenCalled();
    });

    it('si el usuario concedió el permiso desde Ajustes del sistema, lo detecta', async () => {
      storage.saveState({ permissionGranted: false });

      await service.reschedule();

      expect(storage.getState().permissionGranted).toBe(true);
      expect(ln['schedule']).toHaveBeenCalledTimes(1);
    });

    it('agenda hoy y dos días más a la hora sugerida (20:00 por defecto) si aún no pasó', async () => {
      await service.reschedule();

      const notifications = lastScheduled();
      expect(notifications.map((n: { id: number }) => n.id)).toEqual(AUTO_IDS);
      expect(notifications.map((n: { schedule: { at: Date } }) => n.schedule.at)).toEqual([
        at(0, 20),
        at(1, 20),
        at(2, 20),
      ]);
      expect(storage.getState().scheduledNotificationIds).toEqual(AUTO_IDS);
    });

    it('cada notificación lleva canal, título, origen y permite despertar el dispositivo', async () => {
      await service.reschedule();

      const [first] = lastScheduled();
      expect(first).toMatchObject({
        title: 'TRAINING_REMINDER.notifications.title',
        channelId: 'training-reminder',
        extra: { source: 'training_reminder' },
        schedule: { allowWhileIdle: true },
      });
    });

    it('no notifica hoy si ya entrenó hoy: empieza mañana', async () => {
      storage.saveState({ lastTrainedDate: toLocalISODate(NOW) });

      await service.reschedule();

      expect(lastScheduled().map((n: { schedule: { at: Date } }) => n.schedule.at)).toEqual([
        at(1, 20),
        at(2, 20),
        at(3, 20),
      ]);
    });

    it('si ya entrenó ayer sí notifica hoy', async () => {
      storage.saveState({ lastTrainedDate: toLocalISODate(at(-1, 12)) });

      await service.reschedule();

      expect(lastScheduled()[0].schedule.at).toEqual(at(0, 20));
    });

    it('si la hora de hoy ya pasó, empieza mañana', async () => {
      storage.saveState({ overriddenByUser: true, userHour: 14, userMinute: 30 });

      await service.reschedule();

      expect(lastScheduled().map((n: { schedule: { at: Date } }) => n.schedule.at)).toEqual([
        at(1, 14, 30),
        at(2, 14, 30),
        at(3, 14, 30),
      ]);
    });

    it('recalcula la hora sugerida con las sesiones recientes y la guarda', async () => {
      for (let day = 1; day <= 5; day++) {
        storage.addEvent({ timestamp: at(-day, 18, 40).getTime(), hourLocal: 18, minuteLocal: 40 });
      }

      await service.reschedule();

      expect(storage.getState()).toMatchObject({ suggestedHour: 18, suggestedMinute: 30 });
      expect(lastScheduled()[0].schedule.at).toEqual(at(0, 18, 30));
    });

    it('la hora fijada por el usuario manda sobre la sugerida', async () => {
      storage.addEvent({ timestamp: at(-1, 9).getTime(), hourLocal: 9, minuteLocal: 0 });
      storage.saveState({ overriddenByUser: true, userHour: 21, userMinute: 15 });

      await service.reschedule();

      expect(lastScheduled()[0].schedule.at).toEqual(at(0, 21, 15));
    });

    it('cancela lo anterior antes de agendar lo nuevo (idempotente)', async () => {
      await service.reschedule();

      const cancelOrder = ln['cancel'].mock.invocationCallOrder[0];
      const scheduleOrder = ln['schedule'].mock.invocationCallOrder[0];
      expect(cancelOrder).toBeLessThan(scheduleOrder);
    });

    it('usa el texto de racha con los días cuando hay una racha en juego', async () => {
      // Entrenó los 2 días previos a cada disparo de hoy: racha de 2 el día del primer aviso
      planStorage.getAllPlans.mockReturnValue([
        plan(at(-1, 20).getTime()),
        plan(at(-2, 20).getTime()),
      ]);

      await service.reschedule();

      const [today, tomorrow] = lastScheduled();
      expect(today.body).toBe('TRAINING_REMINDER.notifications.streak|{"days":2}');
      // Mañana "ayer" (hoy) no se ha entrenado: no hay racha que perder
      expect(tomorrow.body).toMatch(/^TRAINING_REMINDER\.notifications\.generic[123]\|\{"days":0\}$/);
    });

    it('los planes del Reto 333 no cuentan para la racha del texto', async () => {
      planStorage.getAllPlans.mockReturnValue([
        plan(at(-1, 20).getTime(), 'reto333'),
        plan(at(-2, 20).getTime(), 'reto333'),
      ]);

      await service.reschedule();

      expect(lastScheduled()[0].body).toMatch(/generic[123]/);
    });

    it('informa a analítica del agendado solo cuando cambia (fecha del primer aviso + hora)', async () => {
      await service.reschedule();
      await service.reschedule();

      expect(eventsLogged().filter((n) => n === 'training_reminder_scheduled')).toHaveLength(1);
      expect(analytics.logEvent).toHaveBeenCalledWith('training_reminder_scheduled', {
        hour: 20,
        minute: 0,
        overridden: false,
        days_ahead: 3,
      });

      storage.saveState({ overriddenByUser: true, userHour: 21, userMinute: 0 });
      await service.reschedule();

      expect(eventsLogged().filter((n) => n === 'training_reminder_scheduled')).toHaveLength(2);
    });

    it('si el SO falla al agendar, no lanza ni deja ids guardados', async () => {
      ln['schedule'].mockRejectedValue(new Error('límite de alarmas'));

      await expect(service.reschedule()).resolves.toBeUndefined();
      expect(storage.getState().scheduledNotificationIds).toEqual([]);
    });
  });

  describe('activar, desactivar y cambiar la hora', () => {
    beforeEach(() => createService(true));

    it('enable pide el permiso, guarda el estado, registra el origen y agenda', async () => {
      osPermission = 'prompt';

      const state = await service.enable('prompt');

      expect(ln['requestPermissions']).toHaveBeenCalled();
      expect(state).toMatchObject({ enabled: true, permissionGranted: true });
      expect(analytics.logEvent).toHaveBeenCalledWith('training_reminder_enabled', {
        source: 'prompt',
        permission_granted: true,
      });
      expect(ln['schedule']).toHaveBeenCalledTimes(1);
    });

    it('si el usuario rechaza el permiso queda activado pero sin agendar', async () => {
      osPermission = 'denied';

      const state = await service.enable('settings');

      expect(state).toMatchObject({ enabled: true, permissionGranted: false });
      expect(analytics.logEvent).toHaveBeenCalledWith('training_reminder_enabled', {
        source: 'settings',
        permission_granted: false,
      });
      expect(ln['schedule']).not.toHaveBeenCalled();
    });

    it('si la petición de permiso falla se trata como no concedido', async () => {
      ln['requestPermissions'].mockRejectedValue(new Error('x'));
      osPermission = 'denied';

      const state = await service.enable('settings');

      expect(state.permissionGranted).toBe(false);
    });

    it('disable apaga el recordatorio, cancela lo pendiente y lo registra', async () => {
      storage.saveState({ enabled: true, permissionGranted: true, scheduledNotificationIds: AUTO_IDS });

      const state = await service.disable();

      expect(state).toMatchObject({ enabled: false, scheduledNotificationIds: [] });
      expect(ln['cancel']).toHaveBeenCalledWith({ notifications: AUTO_IDS.map((id) => ({ id })) });
      expect(eventsLogged()).toContain('training_reminder_disabled');
    });

    it('setUserTime fija la hora, lo registra y reagenda a esa hora', async () => {
      storage.saveState({ enabled: true, permissionGranted: true });

      const state = await service.setUserTime(21, 45);

      expect(state).toMatchObject({ overriddenByUser: true, userHour: 21, userMinute: 45 });
      expect(analytics.logEvent).toHaveBeenCalledWith('training_reminder_time_changed', {
        hour: 21,
        minute: 45,
      });
      expect(lastScheduled()[0].schedule.at).toEqual(at(0, 21, 45));
    });

    it('resetToSuggested quita el override y vuelve a la hora sugerida', async () => {
      storage.saveState({
        enabled: true,
        permissionGranted: true,
        overriddenByUser: true,
        userHour: 6,
        userMinute: 0,
      });

      const state = await service.resetToSuggested();

      expect(state).toMatchObject({ overriddenByUser: false, userHour: null, userMinute: null });
      expect(lastScheduled()[0].schedule.at).toEqual(at(0, 20));
    });
  });

  describe('sesiones de entrenamiento', () => {
    beforeEach(() => {
      createService(true);
      storage.saveState({ enabled: true, permissionGranted: true });
    });

    it('al iniciar una sesión cancela solo el aviso de hoy y conserva los de otros días', async () => {
      pending = [
        { id: AUTO_IDS[0], schedule: { at: at(0, 20) } },
        { id: AUTO_IDS[1], schedule: { at: at(1, 20) } },
        { id: AUTO_IDS[2], schedule: { at: at(2, 20) } },
      ];
      storage.saveState({ scheduledNotificationIds: AUTO_IDS });

      service.onSessionStarted();
      await flush();

      expect(ln['cancel']).toHaveBeenCalledWith({ notifications: [{ id: AUTO_IDS[0] }] });
      expect(storage.getState().scheduledNotificationIds).toEqual([AUTO_IDS[1], AUTO_IDS[2]]);
    });

    it('al iniciar una sesión no toca notificaciones ajenas ni los manuales de hoy', async () => {
      pending = [
        { id: MANUAL_BASE, schedule: { at: at(0, 20) } },
        { id: 12345, schedule: { at: at(0, 20) } },
      ];

      service.onSessionStarted();
      await flush();

      expect(ln['cancel']).not.toHaveBeenCalled();
    });

    it('al iniciar una sesión sin avisos para hoy no cancela nada', async () => {
      pending = [{ id: AUTO_IDS[0], schedule: { at: at(1, 20) } }];

      service.onSessionStarted();
      await flush();

      expect(ln['cancel']).not.toHaveBeenCalled();
    });

    it('al iniciar una sesión, un fallo del SO no lanza', async () => {
      ln['getPending'].mockRejectedValue(new Error('x'));

      service.onSessionStarted();
      await flush();

      expect(ln['cancel']).not.toHaveBeenCalled();
    });

    it('al completar una sesión guarda la hora local de inicio como evento', async () => {
      service.onSessionCompleted({ createdAt: at(0, 14, 25).getTime() });
      await flush();

      expect(storage.getEvents()).toEqual([
        { timestamp: at(0, 14, 25).getTime(), hourLocal: 14, minuteLocal: 25 },
      ]);
    });

    it('al completar una sesión marca hoy como entrenado y el siguiente aviso es mañana', async () => {
      service.onSessionCompleted({ createdAt: at(0, 14, 25).getTime() });
      await flush();

      expect(storage.getState().lastTrainedDate).toBe(toLocalISODate(NOW));
      const [first] = lastScheduled();
      expect(first.schedule.at.getDate()).toBe(NOW.getDate() + 1);
    });
  });

  describe('recordatorios manuales', () => {
    beforeEach(() => createService(true));

    const manualSchedules = () => lastScheduled();

    describe('saveManualReminder', () => {
      const input = (overrides: Partial<Omit<ManualReminder, 'seq'>> = {}) => ({
        id: 'm-nuevo',
        hour: 7,
        minute: 30,
        weekdays: [] as number[],
        label: 'Mis tácticas',
        enabled: true,
        ...overrides,
      });

      it('crea uno nuevo con la primera ranura libre y lo registra en analítica', async () => {
        storage.saveManualReminders([manual({ id: 'a', seq: 0 }), manual({ id: 'b', seq: 2 })]);

        const result = await service.saveManualReminder(input({ weekdays: [2, 4] }));

        expect(result?.map((r) => [r.id, r.seq])).toEqual([['a', 0], ['b', 2], ['m-nuevo', 1]]);
        expect(storage.getManualReminders()).toEqual(result);
        expect(analytics.logEvent).toHaveBeenCalledWith('training_reminder_manual_created', {
          weekdays: 2,
          hour: 7,
          minute: 30,
        });
      });

      it('al actualizar uno existente conserva su ranura de ids y no cuenta como alta', async () => {
        storage.saveManualReminders([manual({ id: 'm-nuevo', seq: 3, hour: 7 })]);

        const result = await service.saveManualReminder(input({ hour: 9, label: 'Nuevo texto' }));

        expect(result).toHaveLength(1);
        expect(result![0]).toMatchObject({ id: 'm-nuevo', seq: 3, hour: 9, label: 'Nuevo texto' });
        expect(eventsLogged()).not.toContain('training_reminder_manual_created');
        expect(manualSchedules()[0].id).toBe(MANUAL_BASE + 3 * 8);
      });

      it('un seq que venga en la entrada no pisa la ranura original', async () => {
        storage.saveManualReminders([manual({ id: 'm-nuevo', seq: 3 })]);

        const result = await service.saveManualReminder({ ...input(), seq: 9 });

        expect(result![0].seq).toBe(3);
      });

      it('con el máximo alcanzado no crea otro y devuelve null', async () => {
        storage.saveManualReminders(
          Array.from({ length: MAX_MANUAL_REMINDERS }, (_, i) => manual({ id: `m${i}`, seq: i }))
        );

        const result = await service.saveManualReminder(input());

        expect(result).toBeNull();
        expect(storage.getManualReminders()).toHaveLength(MAX_MANUAL_REMINDERS);
        expect(ln['schedule']).not.toHaveBeenCalled();
      });

      it('con el máximo alcanzado sí permite editar uno existente', async () => {
        storage.saveManualReminders(
          Array.from({ length: MAX_MANUAL_REMINDERS }, (_, i) => manual({ id: `m${i}`, seq: i }))
        );

        const result = await service.saveManualReminder(input({ id: 'm4', label: 'Editado' }));

        expect(result).toHaveLength(MAX_MANUAL_REMINDERS);
        expect(result![4].label).toBe('Editado');
      });

      it('si está activado y el permiso aún no se decidió, lo pide y agenda', async () => {
        osPermission = 'prompt';

        await service.saveManualReminder(input());

        expect(ln['requestPermissions']).toHaveBeenCalledTimes(1);
        expect(storage.getState().permissionGranted).toBe(true);
        expect(ln['schedule']).toHaveBeenCalledTimes(1);
      });

      it('si el permiso ya está concedido o denegado no vuelve a pedirlo', async () => {
        await service.saveManualReminder(input());
        osPermission = 'denied';
        await service.saveManualReminder(input({ id: 'otro' }));

        expect(ln['requestPermissions']).not.toHaveBeenCalled();
      });

      it('si se guarda desactivado no pide permiso y no agenda nada', async () => {
        osPermission = 'prompt';

        await service.saveManualReminder(input({ enabled: false }));

        expect(ln['requestPermissions']).not.toHaveBeenCalled();
        expect(ln['schedule']).not.toHaveBeenCalled();
      });

      it('si el usuario deniega el permiso se guarda el recordatorio pero no se agenda', async () => {
        osPermission = 'denied';

        const result = await service.saveManualReminder(input());

        expect(result).toHaveLength(1);
        expect(ln['schedule']).not.toHaveBeenCalled();
      });
    });

    describe('qué se agenda', () => {
      it('sin días de la semana, una notificación diaria repetida a esa hora', async () => {
        storage.saveManualReminders([manual({ seq: 2, hour: 7, minute: 30, weekdays: [] })]);

        await service.toggleManualReminder('m1', true);

        expect(manualSchedules()).toEqual([
          {
            id: MANUAL_BASE + 2 * 8,
            title: 'TRAINING_REMINDER.notifications.title',
            body: 'Mis tácticas',
            channelId: 'training-reminder',
            schedule: { on: { hour: 7, minute: 30 }, repeats: true, allowWhileIdle: true },
            extra: { source: 'training_reminder_manual', reminderId: 'm1' },
          },
        ]);
      });

      it('con días elegidos, una notificación semanal por día con su id (ranura*8 + weekday)', async () => {
        storage.saveManualReminders([manual({ seq: 1, weekdays: [2, 4, 1] })]);

        await service.toggleManualReminder('m1', true);

        const sent = manualSchedules();
        expect(sent.map((n: { id: number }) => n.id)).toEqual([
          MANUAL_BASE + 8 + 2,
          MANUAL_BASE + 8 + 4,
          MANUAL_BASE + 8 + 1,
        ]);
        expect(sent.map((n: { schedule: { on: unknown } }) => n.schedule.on)).toEqual([
          { weekday: 2, hour: 7, minute: 30 },
          { weekday: 4, hour: 7, minute: 30 },
          { weekday: 1, hour: 7, minute: 30 },
        ]);
      });

      it('recordatorios distintos nunca comparten id', async () => {
        storage.saveManualReminders([
          manual({ id: 'a', seq: 0, weekdays: [1, 2, 3, 4, 5, 6, 7] }),
          manual({ id: 'b', seq: 1, weekdays: [1, 2, 3, 4, 5, 6, 7] }),
          manual({ id: 'c', seq: 14, weekdays: [] }),
        ]);

        await service.toggleManualReminder('a', true);

        const ids = manualSchedules().map((n: { id: number }) => n.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids.every((id: number) => id >= MANUAL_BASE)).toBe(true);
      });

      it('sin texto usa el mensaje genérico (también con solo espacios)', async () => {
        storage.saveManualReminders([manual({ label: '   ' })]);

        await service.toggleManualReminder('m1', true);

        expect(manualSchedules()[0].body).toBe('TRAINING_REMINDER.notifications.generic1');
      });

      it('los desactivados no se agendan', async () => {
        storage.saveManualReminders([
          manual({ id: 'on', seq: 0 }),
          manual({ id: 'off', seq: 1, enabled: false }),
        ]);

        await service.toggleManualReminder('on', true);

        expect(manualSchedules().map((n: { extra: { reminderId: string } }) => n.extra.reminderId)).toEqual(['on']);
      });

      it('si no hay ninguno activado no llama a schedule', async () => {
        storage.saveManualReminders([manual({ enabled: false })]);

        await service.toggleManualReminder('m1', false);

        expect(ln['schedule']).not.toHaveBeenCalled();
      });

      it('sin permiso no agenda ninguno, pero sí limpia los anteriores', async () => {
        osPermission = 'denied';
        pending = [{ id: MANUAL_BASE }];
        storage.saveManualReminders([manual()]);

        await service.toggleManualReminder('m1', true);

        expect(ln['cancel']).toHaveBeenCalledWith({ notifications: [{ id: MANUAL_BASE }] });
        expect(ln['schedule']).not.toHaveBeenCalled();
      });

      it('al reagendar cancela solo el rango de manuales, no los automáticos ni lo ajeno', async () => {
        pending = [
          { id: AUTO_IDS[0] }, // automático
          { id: TEST_ID }, // prueba (741999 < 742000)
          { id: MANUAL_BASE }, // primer manual
          { id: MANUAL_BASE + 15 * 8 - 1 }, // último id posible de manuales
          { id: MANUAL_BASE + 15 * 8 }, // ya fuera del rango
          { id: 5 },
        ];
        storage.saveManualReminders([manual()]);

        await service.toggleManualReminder('m1', true);

        const cancelled = ln['cancel'].mock.calls[0][0].notifications;
        expect(cancelled).toEqual([{ id: MANUAL_BASE }, { id: MANUAL_BASE + 15 * 8 - 1 }]);
      });

      it('si el SO falla al agendar, no lanza', async () => {
        ln['schedule'].mockRejectedValue(new Error('límite'));
        storage.saveManualReminders([manual()]);

        await expect(service.toggleManualReminder('m1', true)).resolves.toHaveLength(1);
      });

      it('si falla la cancelación de los anteriores, igualmente agenda los nuevos', async () => {
        ln['getPending'].mockRejectedValue(new Error('x'));
        storage.saveManualReminders([manual()]);

        await service.toggleManualReminder('m1', true);

        expect(ln['schedule']).toHaveBeenCalledTimes(1);
      });
    });

    describe('deleteManualReminder', () => {
      it('lo borra, lo registra y reagenda sin él', async () => {
        pending = [{ id: MANUAL_BASE }];
        storage.saveManualReminders([manual({ id: 'a', seq: 0 }), manual({ id: 'b', seq: 1 })]);

        const result = await service.deleteManualReminder('a');

        expect(result.map((r) => r.id)).toEqual(['b']);
        expect(storage.getManualReminders().map((r) => r.id)).toEqual(['b']);
        expect(eventsLogged()).toContain('training_reminder_manual_deleted');
        expect(ln['cancel']).toHaveBeenCalledWith({ notifications: [{ id: MANUAL_BASE }] });
        expect(manualSchedules().map((n: { id: number }) => n.id)).toEqual([MANUAL_BASE + 8]);
      });

      it('con un id que no existe deja la lista igual', async () => {
        storage.saveManualReminders([manual()]);

        const result = await service.deleteManualReminder('no-existe');

        expect(result).toHaveLength(1);
      });
    });

    describe('toggleManualReminder', () => {
      it('activar uno pide el permiso si no estaba decidido y lo agenda', async () => {
        osPermission = 'prompt';
        storage.saveManualReminders([manual({ enabled: false })]);

        const result = await service.toggleManualReminder('m1', true);

        expect(result[0].enabled).toBe(true);
        expect(ln['requestPermissions']).toHaveBeenCalledTimes(1);
        expect(ln['schedule']).toHaveBeenCalledTimes(1);
      });

      it('desactivar uno no pide permiso y lo quita de lo agendado', async () => {
        pending = [{ id: MANUAL_BASE }];
        storage.saveManualReminders([manual({ enabled: true })]);

        const result = await service.toggleManualReminder('m1', false);

        expect(result[0].enabled).toBe(false);
        expect(ln['requestPermissions']).not.toHaveBeenCalled();
        expect(ln['cancel']).toHaveBeenCalled();
        expect(ln['schedule']).not.toHaveBeenCalled();
      });

      it('solo cambia el recordatorio indicado', async () => {
        storage.saveManualReminders([
          manual({ id: 'a', seq: 0, enabled: true }),
          manual({ id: 'b', seq: 1, enabled: true }),
        ]);

        const result = await service.toggleManualReminder('a', false);

        expect(result.map((r) => r.enabled)).toEqual([false, true]);
      });
    });

    it('canAddManualReminder es false al llegar al máximo', () => {
      storage.saveManualReminders(
        Array.from({ length: MAX_MANUAL_REMINDERS - 1 }, (_, i) => manual({ id: `m${i}`, seq: i }))
      );
      expect(service.canAddManualReminder).toBe(true);

      storage.saveManualReminders(
        Array.from({ length: MAX_MANUAL_REMINDERS }, (_, i) => manual({ id: `m${i}`, seq: i }))
      );
      expect(service.canAddManualReminder).toBe(false);
    });

    it('newManualReminderId usa el generador de uids de la app', () => {
      expect(service.newManualReminderId()).toBe('uid-nuevo');
    });
  });

  describe('notificación de prueba', () => {
    beforeEach(() => createService(true));

    it('se agenda en ~2 s saltándose las reglas (aunque ya haya entrenado hoy) y se registra', async () => {
      storage.saveState({ enabled: false, lastTrainedDate: toLocalISODate(NOW) });

      const sent = await service.sendTestNotification();

      expect(sent).toBe(true);
      const [notification] = lastScheduled();
      expect(notification).toMatchObject({
        id: TEST_ID,
        body: 'TRAINING_REMINDER.test.body',
        extra: { source: 'training_reminder_test' },
      });
      expect(notification.schedule.at.getTime()).toBe(NOW.getTime() + 2000);
      expect(eventsLogged()).toContain('training_reminder_test_sent');
    });

    it('pide el permiso si faltaba y, si se concede, envía', async () => {
      osPermission = 'prompt';

      expect(await service.sendTestNotification()).toBe(true);
      expect(ln['requestPermissions']).toHaveBeenCalled();
    });

    it('sin permiso devuelve false y no agenda', async () => {
      osPermission = 'denied';

      expect(await service.sendTestNotification()).toBe(false);
      expect(ln['schedule']).not.toHaveBeenCalled();
      expect(eventsLogged()).not.toContain('training_reminder_test_sent');
    });

    it('si el SO falla al agendar devuelve false', async () => {
      ln['schedule'].mockRejectedValue(new Error('x'));

      expect(await service.sendTestNotification()).toBe(false);
    });
  });

  describe('getUpcoming', () => {
    beforeEach(() => createService(true));

    it('sin nada activado no hay próximas', () => {
      expect(service.getUpcoming()).toEqual([]);
    });

    it('el automático aporta 3 días a la hora efectiva', () => {
      storage.saveState({ enabled: true, permissionGranted: true });

      expect(service.getUpcoming()).toEqual([
        { date: at(0, 20).getTime(), kind: 'automatic', label: '' },
        { date: at(1, 20).getTime(), kind: 'automatic', label: '' },
        { date: at(2, 20).getTime(), kind: 'automatic', label: '' },
      ]);
    });

    it('el automático sin permiso concedido no aparece', () => {
      storage.saveState({ enabled: true, permissionGranted: false });

      expect(service.getUpcoming()).toEqual([]);
    });

    it('el automático respeta "ya entrenó hoy"', () => {
      storage.saveState({ enabled: true, permissionGranted: true, lastTrainedDate: toLocalISODate(NOW) });

      expect(service.getUpcoming()[0].date).toBe(at(1, 20).getTime());
    });

    it('cada manual activado aporta sus 2 próximas ocurrencias, ordenadas junto al automático', () => {
      storage.saveState({ enabled: true, permissionGranted: true });
      // Hoy es sábado 10: el próximo lunes (weekday 2) es el 12 y el siguiente el 19
      storage.saveManualReminders([
        manual({ id: 'lunes', seq: 0, hour: 21, minute: 0, weekdays: [2], label: 'Lunes' }),
        manual({ id: 'apagado', seq: 1, enabled: false }),
      ]);

      const upcoming = service.getUpcoming();

      const dates = upcoming.map((u) => u.date);
      expect(dates).toEqual([...dates].sort((a, b) => a - b));
      const manuals = upcoming.filter((u) => u.kind === 'manual');
      expect(manuals).toEqual([
        { date: at(2, 21).getTime(), kind: 'manual', label: 'Lunes', reminderId: 'lunes' },
        { date: at(9, 21).getTime(), kind: 'manual', label: 'Lunes', reminderId: 'lunes' },
      ]);
      expect(upcoming.some((u) => u.reminderId === 'apagado')).toBe(false);
    });

    it('respeta el límite pedido quedándose con las más próximas', () => {
      storage.saveState({ enabled: true, permissionGranted: true });

      const upcoming = service.getUpcoming(2);

      expect(upcoming.map((u) => u.date)).toEqual([at(0, 20).getTime(), at(1, 20).getTime()]);
    });
  });
});
