import { Component, inject } from '@angular/core';
import { IonIcon, ModalController } from '@ionic/angular/standalone';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { notificationsOutline } from 'ionicons/icons';

import { TrainingReminderService } from '@services/training-reminder.service';
import { formatReminderTime } from '@services/training-reminder.util';

addIcons({ notificationsOutline });

/**
 * Modal de contexto previo al permiso nativo de notificaciones: explica el
 * valor del recordatorio con la hora habitual inferida antes de disparar el
 * prompt del sistema. Se cierra con rol 'accept' o 'later'; el llamador
 * decide si pedir el permiso (TrainingReminderService.enable).
 */
@Component({
  selector: 'app-reminder-permission-modal',
  standalone: true,
  imports: [TranslocoPipe, IonIcon],
  templateUrl: './reminder-permission-modal.component.html',
  styleUrls: ['./reminder-permission-modal.component.scss'],
})
export class ReminderPermissionModalComponent {
  private modalController = inject(ModalController);
  private translocoService = inject(TranslocoService);
  private trainingReminderService = inject(TrainingReminderService);

  /** Hora habitual inferida, formateada para el pitch. */
  readonly timeLabel: string;

  /**
   * Solo afirmamos "sueles entrenar a esa hora" si la hora sale de verdad de
   * sus sesiones; con pocos datos es el default y el copy no puede prometerlo.
   */
  readonly messageKey: string;

  constructor() {
    const suggested = this.trainingReminderService.getSuggestedTime();
    this.timeLabel = formatReminderTime(
      suggested.hour,
      suggested.minute,
      this.translocoService.getActiveLang()
    );
    this.messageKey = suggested.confident
      ? 'TRAINING_REMINDER.prompt.message'
      : 'TRAINING_REMINDER.prompt.messageGeneric';
  }

  accept(): void {
    void this.modalController.dismiss(null, 'accept');
  }

  later(): void {
    void this.modalController.dismiss(null, 'later');
  }
}
