import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalController } from '@ionic/angular/standalone';

import { ManualReminder } from '@features/reminders/models/reminder.model';
import { TrainingReminderService } from '@features/reminders/services/training-reminder.service';
import { ManualReminderModalComponent } from '@features/reminders/containers/manual-reminder-modal/manual-reminder-modal.component';
import { WEEKDAYS_MON_FIRST } from '@features/reminders/utils/reminder-schedule.util';

import {
  diferida,
  translocoParaPruebas,
  vaciarPromesas,
} from '@tests/support/racha-ajustes-recordatorios';

/**
 * Formulario (bottom-sheet) de recordatorio manual: crear o editar hora, días de
 * la semana (ninguno = todos los días) y etiqueta. Guarda con el servicio y
 * cierra con el rol 'saved'; cancelar cierra con 'cancel'.
 *
 * Weekday del plugin: 1=Dom, 2=Lun ... 7=Sáb; los chips salen de lunes a domingo.
 */
const EXISTENTE: ManualReminder = {
  id: 'rem-7',
  seq: 3,
  hour: 7,
  minute: 5,
  weekdays: [2, 4],
  label: 'Antes del trabajo',
  enabled: false,
};

describe('ManualReminderModalComponent', () => {
  let fixture: ComponentFixture<ManualReminderModalComponent>;
  let modal: ManualReminderModalComponent;

  const modalController = { dismiss: jest.fn() };
  const reminders = {
    saveManualReminder: jest.fn(),
    newManualReminderId: jest.fn(),
  };

  function crear(reminder?: ManualReminder) {
    fixture = TestBed.createComponent(ManualReminderModalComponent);
    modal = fixture.componentInstance;
    if (reminder) {
      fixture.componentRef.setInput('reminder', reminder);
    }
    fixture.detectChanges();
  }

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  /** Chips de día, en el orden en que se pintan. */
  function chips(): HTMLButtonElement[] {
    return Array.from(el().querySelectorAll<HTMLButtonElement>('button.btn-sm:not(.btn-circle)'));
  }

  function chipSeleccionados(): string[] {
    return chips()
      .filter((c) => c.classList.contains('btn-primary'))
      .map((c) => (c.textContent ?? '').trim());
  }

  function boton(texto: string): HTMLButtonElement {
    const encontrado = Array.from(el().querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes(texto)
    );
    if (!encontrado) {
      throw new Error(`No hay botón "${texto}"`);
    }
    return encontrado;
  }

  function escribirHora(valor: string) {
    const input = el().querySelector('input[type="time"]') as HTMLInputElement;
    input.value = valor;
    input.dispatchEvent(new Event('change'));
  }

  function escribirEtiqueta(valor: string) {
    const input = el().querySelector('input[type="text"]') as HTMLInputElement;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    reminders.saveManualReminder.mockResolvedValue([]);
    reminders.newManualReminderId.mockReturnValue('rem-nuevo');

    await TestBed.configureTestingModule({
      imports: [ManualReminderModalComponent, translocoParaPruebas()],
      providers: [
        { provide: ModalController, useValue: modalController },
        { provide: TrainingReminderService, useValue: reminders },
      ],
    }).compileComponents();
  });

  describe('crear uno nuevo', () => {
    beforeEach(() => crear());

    it('arranca a las 08:00, sin etiqueta y con título de "nuevo"', () => {
      expect(modal.isEdit).toBe(false);
      expect(modal.time).toBe('08:00');
      expect((el().querySelector('input[type="time"]') as HTMLInputElement).value).toBe('08:00');
      expect(el().textContent).toContain('TRAINING_REMINDER.manual.newTitle');
      expect(el().textContent).not.toContain('TRAINING_REMINDER.manual.editTitle');
    });

    it('ofrece siete días de lunes a domingo, ninguno elegido', () => {
      expect(chips().map((c) => (c.textContent ?? '').trim())).toEqual([
        'TRAINING_REMINDER.weekdays.mon',
        'TRAINING_REMINDER.weekdays.tue',
        'TRAINING_REMINDER.weekdays.wed',
        'TRAINING_REMINDER.weekdays.thu',
        'TRAINING_REMINDER.weekdays.fri',
        'TRAINING_REMINDER.weekdays.sat',
        'TRAINING_REMINDER.weekdays.sun',
      ]);
      expect(chipSeleccionados()).toEqual([]);
    });

    it('pulsar un día lo selecciona y volver a pulsarlo lo quita', () => {
      chips()[2].click();
      fixture.detectChanges();
      expect(chipSeleccionados()).toEqual(['TRAINING_REMINDER.weekdays.wed']);

      chips()[2].click();
      fixture.detectChanges();
      expect(chipSeleccionados()).toEqual([]);
    });

    it('guarda con id nuevo, la hora elegida, los días marcados y la etiqueta sin espacios', async () => {
      escribirHora('21:45');
      escribirEtiqueta('  Después de cenar  ');
      chips()[0].click(); // lunes
      chips()[4].click(); // viernes
      fixture.detectChanges();

      boton('COMMON.actions.save').click();
      await vaciarPromesas();

      expect(reminders.saveManualReminder).toHaveBeenCalledTimes(1);
      expect(reminders.saveManualReminder).toHaveBeenCalledWith({
        id: 'rem-nuevo',
        seq: undefined,
        hour: 21,
        minute: 45,
        weekdays: [2, 6],
        label: 'Después de cenar',
        enabled: true,
      });
      expect(modalController.dismiss).toHaveBeenCalledWith(null, 'saved');
    });

    it('sin ningún día elegido guarda la lista vacía (todos los días)', async () => {
      boton('COMMON.actions.save').click();
      await vaciarPromesas();

      expect(reminders.saveManualReminder.mock.calls[0][0]).toMatchObject({
        hour: 8,
        minute: 0,
        weekdays: [],
        label: '',
      });
    });

    it('los días se guardan como Weekday del plugin, de lunes a domingo', async () => {
      chips().forEach((c) => c.click());
      fixture.detectChanges();

      boton('COMMON.actions.save').click();
      await vaciarPromesas();

      expect(reminders.saveManualReminder.mock.calls[0][0].weekdays).toEqual(WEEKDAYS_MON_FIRST);
    });

    it('un doble toque en guardar no crea el recordatorio dos veces', async () => {
      const lento = diferida<null>();
      reminders.saveManualReminder.mockReturnValue(lento.promesa);
      const guardar = boton('COMMON.actions.save');

      guardar.click();
      guardar.click();
      fixture.detectChanges();
      lento.resolver(null);
      await vaciarPromesas();

      expect(reminders.saveManualReminder).toHaveBeenCalledTimes(1);
      expect(modalController.dismiss).toHaveBeenCalledTimes(1);
      expect(guardar.disabled).toBe(true);
    });

    it('si la hora no es un número no guarda ni cierra', async () => {
      modal.time = 'abc:de';

      await modal.save();

      expect(reminders.saveManualReminder).not.toHaveBeenCalled();
      expect(modalController.dismiss).not.toHaveBeenCalled();
      expect(modal.saving).toBe(false);
    });

    // La hora vacía (campo borrado) no es un "hh:mm" completo: no se guarda.
    it('con la hora vacía no debería guardar un recordatorio sin minuto', async () => {
      modal.time = '';

      await modal.save();

      expect(reminders.saveManualReminder).not.toHaveBeenCalled();
      expect(modalController.dismiss).not.toHaveBeenCalled();
    });

    it('cancelar cierra con el rol cancel sin guardar', () => {
      boton('COMMON.actions.cancel').click();

      expect(modalController.dismiss).toHaveBeenCalledWith(null, 'cancel');
      expect(reminders.saveManualReminder).not.toHaveBeenCalled();
    });

    it('la X de la cabecera también cancela', () => {
      (el().querySelector('button.btn-circle') as HTMLButtonElement).click();

      expect(modalController.dismiss).toHaveBeenCalledWith(null, 'cancel');
    });
  });

  describe('editar uno existente', () => {
    beforeEach(() => crear(EXISTENTE));

    it('rellena la hora (con ceros), la etiqueta y los días del recordatorio', () => {
      expect(modal.isEdit).toBe(true);
      expect((el().querySelector('input[type="time"]') as HTMLInputElement).value).toBe('07:05');
      expect((el().querySelector('input[type="text"]') as HTMLInputElement).value).toBe(
        'Antes del trabajo'
      );
      expect(chipSeleccionados()).toEqual([
        'TRAINING_REMINDER.weekdays.mon',
        'TRAINING_REMINDER.weekdays.wed',
      ]);
      expect(el().textContent).toContain('TRAINING_REMINDER.manual.editTitle');
    });

    it('al guardar conserva el id, la ranura y si estaba desactivado', async () => {
      escribirHora('06:30');
      chips()[0].click(); // quita el lunes
      fixture.detectChanges();

      boton('COMMON.actions.save').click();
      await vaciarPromesas();

      expect(reminders.newManualReminderId).not.toHaveBeenCalled();
      expect(reminders.saveManualReminder).toHaveBeenCalledWith({
        id: 'rem-7',
        seq: 3,
        hour: 6,
        minute: 30,
        weekdays: [4],
        label: 'Antes del trabajo',
        enabled: false,
      });
      expect(modalController.dismiss).toHaveBeenCalledWith(null, 'saved');
    });

    it('permite vaciar la etiqueta', async () => {
      escribirEtiqueta('');

      boton('COMMON.actions.save').click();
      await vaciarPromesas();

      expect(reminders.saveManualReminder.mock.calls[0][0].label).toBe('');
    });
  });
});
