// Los modales se abren por su clase; sus dependencias no hacen falta aquí.
jest.mock('@features/reminders/containers/reminder-permission-modal/reminder-permission-modal.component', () => ({
  ReminderPermissionModalComponent: class ReminderPermissionModalComponent {},
}));
jest.mock('@features/reminders/containers/manual-reminder-modal/manual-reminder-modal.component', () => ({
  ManualReminderModalComponent: class ManualReminderModalComponent {},
}));

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { Capacitor } from '@capacitor/core';
import {
  AlertController,
  IonContent,
  IonIcon,
  ModalController,
} from '@ionic/angular/standalone';
import { TranslocoPipe } from '@jsverse/transloco';

import { AnalyticsService } from '@core/analytics/analytics.service';
import { TrainingReminderService } from '@features/reminders/services/training-reminder.service';
import {
  DEFAULT_TRAINING_REMINDER_STATE,
  ManualReminder,
  TrainingReminderState,
  UpcomingNotification,
} from '@features/reminders/models/reminder.model';
import { ManualReminderModalComponent } from '@features/reminders/containers/manual-reminder-modal/manual-reminder-modal.component';
import { ReminderPermissionModalComponent } from '@features/reminders/containers/reminder-permission-modal/reminder-permission-modal.component';
import { RemindersPage } from '@features/reminders/pages/reminders.page';

import {
  NavbarFalsa,
  controladorFalso,
  superposicionFalsa,
  translocoParaPruebas,
  vaciarPromesas,
} from '@tests/support/racha-ajustes-recordatorios';

/**
 * Pantalla de Recordatorios: recordatorio automático (activar, permiso, hora),
 * recordatorios manuales (crear, editar, activar, borrar), próximas
 * notificaciones y disparo de prueba. Solo tiene sentido en nativo.
 */

function manual(id: string, extra: Partial<ManualReminder> = {}): ManualReminder {
  return {
    id,
    seq: 0,
    hour: 8,
    minute: 0,
    weekdays: [],
    label: '',
    enabled: true,
    ...extra,
  };
}

describe('RemindersPage', () => {
  let fixture: ComponentFixture<RemindersPage>;
  let page: RemindersPage;

  let estado: TrainingReminderState;
  let manuales: ManualReminder[];
  let proximas: UpcomingNotification[];
  let puedeAgregar: boolean;
  let sugerida: { hour: number; minute: number; confident: boolean };

  const router = { navigate: jest.fn() };
  const analytics = { logEvent: jest.fn() };
  const reminders = {
    getState: jest.fn(),
    getSuggestedTime: jest.fn(),
    getManualReminders: jest.fn(),
    getUpcoming: jest.fn(),
    reschedule: jest.fn(),
    checkPermissionStatus: jest.fn(),
    enable: jest.fn(),
    disable: jest.fn(),
    setUserTime: jest.fn(),
    resetToSuggested: jest.fn(),
    markContextPromptShown: jest.fn(),
    toggleManualReminder: jest.fn(),
    deleteManualReminder: jest.fn(),
    sendTestNotification: jest.fn(),
    canAddManualReminder: true,
  };
  const modal = superposicionFalsa();
  const alert = superposicionFalsa();
  const modalController = controladorFalso(modal);
  const alertController = controladorFalso(alert);

  async function crear(opciones: { nativo?: boolean } = { nativo: true }) {
    jest.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(!!opciones.nativo);
    fixture = TestBed.createComponent(RemindersPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
    await vaciarPromesas();
    fixture.detectChanges();
  }

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function texto(): string {
    return el().textContent ?? '';
  }

  function boton(contiene: string): HTMLButtonElement {
    const encontrado = Array.from(el().querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes(contiene)
    );
    if (!encontrado) {
      throw new Error(`No hay botón "${contiene}"`);
    }
    return encontrado;
  }

  /** Interruptor automático (el primero) o el de un manual (por posición). */
  function interruptores(): HTMLInputElement[] {
    return Array.from(el().querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
  }

  function inputHora(): HTMLInputElement | null {
    return el().querySelector('input[type="time"]');
  }

  async function cambiar(input: HTMLInputElement, valor: { checked?: boolean; value?: string }) {
    if (valor.checked !== undefined) {
      input.checked = valor.checked;
    }
    if (valor.value !== undefined) {
      input.value = valor.value;
    }
    input.dispatchEvent(new Event('change'));
    await vaciarPromesas();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    estado = { ...DEFAULT_TRAINING_REMINDER_STATE };
    manuales = [];
    proximas = [];
    puedeAgregar = true;
    sugerida = { hour: 20, minute: 0, confident: true };

    reminders.getState.mockImplementation(() => estado);
    reminders.getSuggestedTime.mockImplementation(() => sugerida);
    reminders.getManualReminders.mockImplementation(() => manuales);
    reminders.getUpcoming.mockImplementation(() => proximas);
    Object.defineProperty(reminders, 'canAddManualReminder', {
      get: () => puedeAgregar,
      configurable: true,
    });
    reminders.reschedule.mockResolvedValue(undefined);
    reminders.checkPermissionStatus.mockResolvedValue('granted');
    reminders.enable.mockImplementation(async () => {
      estado = { ...estado, enabled: true, permissionGranted: true };
      return estado;
    });
    reminders.disable.mockImplementation(async () => {
      estado = { ...estado, enabled: false };
      return estado;
    });
    reminders.setUserTime.mockResolvedValue(estado);
    reminders.resetToSuggested.mockResolvedValue(estado);
    reminders.toggleManualReminder.mockResolvedValue([]);
    reminders.deleteManualReminder.mockResolvedValue([]);
    reminders.sendTestNotification.mockResolvedValue(true);
    analytics.logEvent.mockResolvedValue(undefined);
    modal.present.mockClear();
    modal.onWillDismiss.mockResolvedValue({ role: 'accept' });
    alert.present.mockClear();

    await TestBed.configureTestingModule({
      imports: [RemindersPage, translocoParaPruebas()],
      providers: [
        { provide: Router, useValue: router },
        { provide: ModalController, useValue: modalController },
        { provide: AlertController, useValue: alertController },
        { provide: AnalyticsService, useValue: analytics },
        { provide: TrainingReminderService, useValue: reminders },
      ],
    })
      .overrideComponent(RemindersPage, {
        set: {
          imports: [CommonModule, TranslocoPipe, IonContent, IonIcon, NavbarFalsa],
        },
      })
      .compileComponents();
  });

  afterEach(() => {
    fixture.destroy();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('en web', () => {
    it('solo avisa de que los recordatorios funcionan en la app móvil', async () => {
      await crear({ nativo: false });

      expect(texto()).toContain('TRAINING_REMINDER.webOnlyNotice');
      expect(texto()).not.toContain('TRAINING_REMINDER.automaticTitle');
      expect(texto()).not.toContain('TRAINING_REMINDER.manualTitle');
      expect(inputHora()).toBeNull();
    });

    it('no intenta reprogramar notificaciones que no existen', async () => {
      await crear({ nativo: false });

      expect(reminders.reschedule).not.toHaveBeenCalled();
    });

    it('el enlace "Home" sigue funcionando', async () => {
      await crear({ nativo: false });

      (el().querySelector('.breadcrumbs a') as HTMLElement).click();

      expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });
  });

  describe('arranque en nativo', () => {
    it('resincroniza el agendado por si el permiso cambió fuera de la app y relee el estado', async () => {
      reminders.reschedule.mockImplementation(async () => {
        estado = { ...estado, enabled: true, permissionGranted: false };
      });

      await crear();

      expect(reminders.reschedule).toHaveBeenCalledTimes(1);
      expect(page.reminderState.enabled).toBe(true);
      expect(texto()).toContain('TRAINING_REMINDER.permissionDenied');
    });

    it('muestra las tres secciones y el botón de prueba', async () => {
      await crear();

      expect(texto()).toContain('TRAINING_REMINDER.automaticTitle');
      expect(texto()).toContain('TRAINING_REMINDER.manualTitle');
      expect(texto()).toContain('TRAINING_REMINDER.upcomingTitle');
      expect(texto()).toContain('TRAINING_REMINDER.test.button');
    });
  });

  describe('recordatorio automático', () => {
    it('desactivado: solo el interruptor, sin hora ni avisos', async () => {
      await crear();

      expect(interruptores()[0].checked).toBe(false);
      expect(inputHora()).toBeNull();
      expect(texto()).not.toContain('TRAINING_REMINDER.permissionDenied');
    });

    it('activado sin permiso del sistema avisa de que no llegarán notificaciones', async () => {
      estado = { ...estado, enabled: true, permissionGranted: false };
      await crear();

      expect(texto()).toContain('TRAINING_REMINDER.permissionDenied');
      expect(inputHora()).toBeNull();
    });

    it('activado con permiso muestra la hora sugerida con ceros y la pista "según tus sesiones"', async () => {
      estado = { ...estado, enabled: true, permissionGranted: true, suggestedHour: 8, suggestedMinute: 5 };
      await crear();

      expect(inputHora()?.value).toBe('08:05');
      expect(page.reminderTimeValue).toBe('08:05');
      expect(texto()).toContain('TRAINING_REMINDER.suggestedHint');
    });

    it('con pocos datos para inferir la hora, la pista es la genérica', async () => {
      sugerida = { hour: 20, minute: 0, confident: false };
      estado = { ...estado, enabled: true, permissionGranted: true };
      await crear();

      expect(texto()).toContain('TRAINING_REMINDER.defaultHint');
      expect(texto()).not.toContain('TRAINING_REMINDER.suggestedHint');
    });

    it('con hora fijada por el usuario la muestra y ofrece volver a la sugerida', async () => {
      estado = {
        ...estado,
        enabled: true,
        permissionGranted: true,
        overriddenByUser: true,
        userHour: 7,
        userMinute: 30,
      };
      await crear();

      expect(inputHora()?.value).toBe('07:30');
      expect(texto()).toContain('TRAINING_REMINDER.overriddenHint');

      boton('TRAINING_REMINDER.useSuggested').click();
      await vaciarPromesas();

      expect(reminders.resetToSuggested).toHaveBeenCalledTimes(1);
    });

    it('cambiar la hora la guarda con hora y minuto como números', async () => {
      estado = { ...estado, enabled: true, permissionGranted: true };
      await crear();

      await cambiar(inputHora() as HTMLInputElement, { value: '06:45' });

      expect(reminders.setUserTime).toHaveBeenCalledWith(6, 45);
    });

    it('un valor que no es una hora numérica no se guarda', async () => {
      await crear();

      await page.onReminderTimeChange({ target: { value: 'ab:cd' } } as unknown as Event);

      expect(reminders.setUserTime).not.toHaveBeenCalled();
    });

    // Un campo de hora borrado llega como '': no es un "hh:mm" completo y no se guarda.
    it('con la hora borrada no debería guardar nada (llega 0, undefined)', async () => {
      estado = { ...estado, enabled: true, permissionGranted: true };
      await crear();

      await cambiar(inputHora() as HTMLInputElement, { value: '' });

      expect(reminders.setUserTime).not.toHaveBeenCalled();
    });

    it('apagar el interruptor desactiva el recordatorio', async () => {
      estado = { ...estado, enabled: true, permissionGranted: true };
      await crear();

      await cambiar(interruptores()[0], { checked: false });

      expect(reminders.disable).toHaveBeenCalledTimes(1);
      expect(page.reminderState.enabled).toBe(false);
      expect(inputHora()).toBeNull();
    });

    it('encenderlo con el permiso ya concedido lo activa sin enseñar el modal', async () => {
      reminders.checkPermissionStatus.mockResolvedValue('granted');
      await crear();

      await cambiar(interruptores()[0], { checked: true });

      expect(reminders.enable).toHaveBeenCalledWith('settings');
      expect(modalController.create).not.toHaveBeenCalled();
      expect(page.reminderState.enabled).toBe(true);
      expect(interruptores()[0].checked).toBe(true);
    });

    it('sin permiso concedido enseña antes el modal de contexto y lo registra', async () => {
      reminders.checkPermissionStatus.mockResolvedValue('prompt');
      await crear();

      await cambiar(interruptores()[0], { checked: true });

      expect(reminders.markContextPromptShown).toHaveBeenCalledTimes(1);
      expect(analytics.logEvent).toHaveBeenCalledWith('training_reminder_prompt_shown', {
        source: 'reminders',
      });
      expect(modalController.create).toHaveBeenCalledWith(
        expect.objectContaining({ component: ReminderPermissionModalComponent })
      );
      expect(modal.present).toHaveBeenCalledTimes(1);
    });

    it('si acepta en el modal se activa (y pide el permiso del sistema vía enable)', async () => {
      reminders.checkPermissionStatus.mockResolvedValue('prompt');
      modal.onWillDismiss.mockResolvedValue({ role: 'accept' });
      await crear();

      await cambiar(interruptores()[0], { checked: true });

      expect(reminders.enable).toHaveBeenCalledWith('settings');
      expect(interruptores()[0].checked).toBe(true);
    });

    it('si pospone en el modal no se activa y el interruptor vuelve a apagado', async () => {
      reminders.checkPermissionStatus.mockResolvedValue('prompt');
      modal.onWillDismiss.mockResolvedValue({ role: 'later' });
      await crear();

      await cambiar(interruptores()[0], { checked: true });

      expect(reminders.enable).not.toHaveBeenCalled();
      expect(page.reminderState.enabled).toBe(false);
      expect(interruptores()[0].checked).toBe(false);
    });
  });

  describe('recordatorios manuales', () => {
    it('sin ninguno enseña el mensaje de vacío', async () => {
      await crear();

      expect(texto()).toContain('TRAINING_REMINDER.manual.empty');
    });

    it('lista cada uno con hora, etiqueta y días en orden de lunes a domingo', async () => {
      manuales = [
        manual('a', { hour: 7, minute: 30, label: 'Mañana', weekdays: [6, 2] }),
        manual('b', { hour: 21, minute: 0, label: '', weekdays: [] }),
      ];
      await crear();

      const filas = Array.from(el().querySelectorAll('li.rounded-box'));
      expect(filas).toHaveLength(2);
      expect(filas[0].textContent).toContain('· Mañana');
      expect(filas[0].textContent).toContain(
        'TRAINING_REMINDER.weekdays.mon, TRAINING_REMINDER.weekdays.fri'
      );
      expect(filas[1].textContent).not.toContain('·');
      expect(filas[1].textContent).toContain('TRAINING_REMINDER.manual.everyDay');
      expect(texto()).not.toContain('TRAINING_REMINDER.manual.empty');
    });

    it('el interruptor de cada uno refleja si está activo', async () => {
      manuales = [manual('a', { enabled: true }), manual('b', { enabled: false })];
      await crear();

      // El primero es el del recordatorio automático
      expect(interruptores().slice(1).map((i) => i.checked)).toEqual([true, false]);
    });

    it('activar o desactivar uno lo comunica al servicio con su id y relee la lista', async () => {
      manuales = [manual('a', { enabled: true })];
      await crear();
      reminders.getManualReminders.mockClear();

      await cambiar(interruptores()[1], { checked: false });

      expect(reminders.toggleManualReminder).toHaveBeenCalledWith('a', false);
      expect(reminders.getManualReminders).toHaveBeenCalled();
    });

    it('"Añadir" abre el formulario vacío y al cerrarlo recarga la lista', async () => {
      await crear();
      manuales = [manual('nuevo', { label: 'Recién creado' })];

      boton('TRAINING_REMINDER.manual.add').click();
      await vaciarPromesas();
      fixture.detectChanges();

      expect(modalController.create).toHaveBeenCalledWith(
        expect.objectContaining({
          component: ManualReminderModalComponent,
          componentProps: { reminder: undefined },
        })
      );
      expect(modal.present).toHaveBeenCalledTimes(1);
      expect(texto()).toContain('Recién creado');
    });

    it('el lápiz abre el formulario con ese recordatorio', async () => {
      const existente = manual('a', { label: 'Editar' });
      manuales = [existente];
      await crear();

      (el().querySelector('li.rounded-box button:not(.text-error)') as HTMLButtonElement).click();
      await vaciarPromesas();

      expect(modalController.create).toHaveBeenCalledWith(
        expect.objectContaining({ componentProps: { reminder: existente } })
      );
    });

    it('con el máximo de manuales el botón "Añadir" queda deshabilitado', async () => {
      puedeAgregar = false;
      await crear();

      expect(boton('TRAINING_REMINDER.manual.add').disabled).toBe(true);
    });

    it('con el máximo no se abre un formulario nuevo, pero sí se puede editar uno existente', async () => {
      puedeAgregar = false;
      await crear();

      await page.openManualModal();
      expect(modalController.create).not.toHaveBeenCalled();

      await page.openManualModal(manual('a'));
      expect(modalController.create).toHaveBeenCalledTimes(1);
    });

    describe('borrar', () => {
      beforeEach(async () => {
        manuales = [manual('a', { label: 'Borrar' })];
        await crear();
      });

      it('pide confirmación antes de borrar', async () => {
        (el().querySelector('li.rounded-box button.text-error') as HTMLButtonElement).click();
        await vaciarPromesas();

        const opciones = alertController.create.mock.calls[0][0];
        expect(opciones.header).toBe('TRAINING_REMINDER.manual.deleteTitle');
        expect(opciones.buttons.map((b: { role: string }) => b.role)).toEqual(['cancel', 'destructive']);
        expect(alert.present).toHaveBeenCalledTimes(1);
        expect(reminders.deleteManualReminder).not.toHaveBeenCalled();
      });

      it('al confirmar lo borra por id y recarga la lista', async () => {
        await page.confirmDeleteManual(manuales[0]);
        manuales = [];
        const botones = alertController.create.mock.calls[0][0].buttons;

        botones[1].handler();
        await vaciarPromesas();
        fixture.detectChanges();

        expect(reminders.deleteManualReminder).toHaveBeenCalledWith('a');
        expect(page.manualReminders).toEqual([]);
        expect(texto()).toContain('TRAINING_REMINDER.manual.empty');
      });

      it('cancelar no tiene acción y no borra', async () => {
        await page.confirmDeleteManual(manuales[0]);
        const cancelar = alertController.create.mock.calls[0][0].buttons[0];

        expect(cancelar.role).toBe('cancel');
        expect(cancelar.handler).toBeUndefined();
        expect(reminders.deleteManualReminder).not.toHaveBeenCalled();
      });
    });
  });

  describe('próximas notificaciones', () => {
    it('sin ninguna prevista lo dice', async () => {
      await crear();

      expect(texto()).toContain('TRAINING_REMINDER.upcomingEmpty');
    });

    it('lista cada una con su tipo (automática o manual) y la etiqueta del manual', async () => {
      proximas = [
        { date: new Date(2026, 2, 10, 20, 0).getTime(), kind: 'automatic', label: '' },
        { date: new Date(2026, 2, 11, 7, 30).getTime(), kind: 'manual', label: 'Mañana', reminderId: 'a' },
      ];
      await crear();

      const filas = Array.from(el().querySelectorAll('ul.gap-1 li'));
      expect(filas).toHaveLength(2);
      expect(filas[0].textContent).toContain('TRAINING_REMINDER.badgeAutomatic');
      expect(filas[1].textContent).toContain('TRAINING_REMINDER.badgeManual');
      expect(filas[1].textContent).toContain('Mañana');
      expect(filas[0].textContent).not.toContain('Mañana');
      expect(texto()).not.toContain('TRAINING_REMINDER.upcomingEmpty');
    });

    it('formatea la fecha con día corto y hora', async () => {
      await crear();

      const etiqueta = page.formatUpcoming(new Date(2026, 2, 10, 20, 15).getTime());

      expect(etiqueta).toMatch(/(8|20):15/);
    });
  });

  describe('probar ahora', () => {
    it('si la notificación de prueba sale, lo confirma y el aviso desaparece a los 4 s', async () => {
      await crear();

      boton('TRAINING_REMINDER.test.button').click();
      await vaciarPromesas();
      fixture.detectChanges();

      expect(reminders.sendTestNotification).toHaveBeenCalledTimes(1);
      expect(texto()).toContain('TRAINING_REMINDER.test.sent');

      jest.advanceTimersByTime(3999);
      fixture.detectChanges();
      expect(texto()).toContain('TRAINING_REMINDER.test.sent');

      jest.advanceTimersByTime(1);
      fixture.detectChanges();
      expect(texto()).not.toContain('TRAINING_REMINDER.test.sent');
    });

    it('si no se pudo enviar (p. ej. sin permiso) lo dice', async () => {
      reminders.sendTestNotification.mockResolvedValue(false);
      await crear();

      boton('TRAINING_REMINDER.test.button').click();
      await vaciarPromesas();
      fixture.detectChanges();

      expect(texto()).toContain('TRAINING_REMINDER.test.failed');
      expect(texto()).not.toContain('TRAINING_REMINDER.test.sent');
    });
  });
});
