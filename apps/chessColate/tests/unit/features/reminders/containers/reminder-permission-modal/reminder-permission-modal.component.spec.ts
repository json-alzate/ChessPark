import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalController } from '@ionic/angular/standalone';

import { TrainingReminderService } from '@features/reminders/services/training-reminder.service';
import { ReminderPermissionModalComponent } from '@features/reminders/containers/reminder-permission-modal/reminder-permission-modal.component';
import { formatReminderTime } from '@features/reminders/utils/reminder-time.util';

import { translocoParaPruebas } from '@tests/support/racha-ajustes-recordatorios';

/**
 * Modal de contexto previo al permiso nativo de notificaciones: explica el valor
 * del recordatorio con la hora habitual y solo promete "sueles entrenar a esa
 * hora" cuando la hora sale de sesiones reales.
 */
describe('ReminderPermissionModalComponent', () => {
  let fixture: ComponentFixture<ReminderPermissionModalComponent>;

  const modalController = { dismiss: jest.fn() };
  const reminders = { getSuggestedTime: jest.fn() };

  async function crear(sugerida: { hour: number; minute: number; confident: boolean }) {
    reminders.getSuggestedTime.mockReturnValue(sugerida);
    fixture = TestBed.createComponent(ReminderPermissionModalComponent);
    fixture.detectChanges();
  }

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
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

  beforeEach(async () => {
    jest.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [
        ReminderPermissionModalComponent,
        translocoParaPruebas({
          'TRAINING_REMINDER.prompt.message': 'Sueles entrenar a las {{time}}',
          'TRAINING_REMINDER.prompt.messageGeneric': 'Te avisamos a las {{time}}',
        }),
      ],
      providers: [
        { provide: ModalController, useValue: modalController },
        { provide: TrainingReminderService, useValue: reminders },
      ],
    }).compileComponents();
  });

  it('con hora inferida de sesiones reales afirma "sueles entrenar" y muestra esa hora', async () => {
    await crear({ hour: 20, minute: 30, confident: true });

    const hora = formatReminderTime(20, 30, 'es');
    expect(fixture.componentInstance.timeLabel).toBe(hora);
    expect(fixture.componentInstance.messageKey).toBe('TRAINING_REMINDER.prompt.message');
    expect(el().textContent).toContain(`Sueles entrenar a las ${hora}`);
  });

  it('con pocos datos usa el texto genérico: no promete algo que no sabe', async () => {
    await crear({ hour: 20, minute: 0, confident: false });

    const hora = formatReminderTime(20, 0, 'es');
    expect(fixture.componentInstance.messageKey).toBe('TRAINING_REMINDER.prompt.messageGeneric');
    expect(el().textContent).toContain(`Te avisamos a las ${hora}`);
    expect(el().textContent).not.toContain('Sueles entrenar');
  });

  it('muestra el título y los dos botones', async () => {
    await crear({ hour: 8, minute: 0, confident: true });

    expect(el().textContent).toContain('TRAINING_REMINDER.prompt.title');
    expect(boton('TRAINING_REMINDER.prompt.accept')).toBeDefined();
    expect(boton('TRAINING_REMINDER.prompt.later')).toBeDefined();
  });

  it('"aceptar" cierra el modal con el rol accept', async () => {
    await crear({ hour: 8, minute: 0, confident: true });

    boton('TRAINING_REMINDER.prompt.accept').click();

    expect(modalController.dismiss).toHaveBeenCalledTimes(1);
    expect(modalController.dismiss).toHaveBeenCalledWith(null, 'accept');
  });

  it('"más tarde" cierra el modal con el rol later', async () => {
    await crear({ hour: 8, minute: 0, confident: true });

    boton('TRAINING_REMINDER.prompt.later').click();

    expect(modalController.dismiss).toHaveBeenCalledTimes(1);
    expect(modalController.dismiss).toHaveBeenCalledWith(null, 'later');
  });
});
