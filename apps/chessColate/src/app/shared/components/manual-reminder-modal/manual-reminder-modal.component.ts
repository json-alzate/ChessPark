import { Component, Input, OnInit, inject } from '@angular/core';
import { IonIcon, ModalController } from '@ionic/angular/standalone';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { closeOutline, trashOutline } from 'ionicons/icons';

import { TrainingReminderService } from '@services/training-reminder.service';
import {
  ManualReminder,
  WEEKDAYS_MON_FIRST,
  weekdayKey,
} from '@services/training-reminder.util';

addIcons({ closeOutline, trashOutline });

interface WeekdayChip {
  weekday: number;
  labelKey: string;
  selected: boolean;
}

/**
 * Formulario (bottom-sheet) para crear o editar un recordatorio manual:
 * hora, días de la semana (vacío = todos los días) y una etiqueta opcional.
 * Al guardar persiste vía TrainingReminderService y cierra con rol 'saved'.
 */
@Component({
  selector: 'app-manual-reminder-modal',
  standalone: true,
  imports: [TranslocoPipe, IonIcon],
  templateUrl: './manual-reminder-modal.component.html',
  styleUrls: ['./manual-reminder-modal.component.scss'],
})
export class ManualReminderModalComponent implements OnInit {
  private modalController = inject(ModalController);
  private trainingReminderService = inject(TrainingReminderService);

  /** Recordatorio a editar; ausente para crear uno nuevo. */
  @Input() reminder?: ManualReminder;

  time = '08:00';
  label = '';
  weekdays: WeekdayChip[] = [];
  saving = false;

  get isEdit(): boolean {
    return !!this.reminder;
  }

  ngOnInit(): void {
    this.weekdays = WEEKDAYS_MON_FIRST.map((weekday) => ({
      weekday,
      labelKey: `TRAINING_REMINDER.weekdays.${weekdayKey(weekday)}`,
      selected: this.reminder?.weekdays.includes(weekday) ?? false,
    }));

    if (this.reminder) {
      this.time = `${String(this.reminder.hour).padStart(2, '0')}:${String(
        this.reminder.minute
      ).padStart(2, '0')}`;
      this.label = this.reminder.label;
    }
  }

  toggleWeekday(chip: WeekdayChip): void {
    chip.selected = !chip.selected;
  }

  async save(): Promise<void> {
    if (this.saving) {
      return;
    }
    const [hour, minute] = this.time.split(':').map(Number);
    if (Number.isNaN(hour) || Number.isNaN(minute)) {
      return;
    }
    this.saving = true;

    const selectedWeekdays = this.weekdays
      .filter((c) => c.selected)
      .map((c) => c.weekday);

    await this.trainingReminderService.saveManualReminder({
      id: this.reminder?.id ?? this.trainingReminderService.newManualReminderId(),
      seq: this.reminder?.seq,
      hour,
      minute,
      weekdays: selectedWeekdays,
      label: this.label.trim(),
      enabled: this.reminder?.enabled ?? true,
    });

    void this.modalController.dismiss(null, 'saved');
  }

  cancel(): void {
    void this.modalController.dismiss(null, 'cancel');
  }
}
