import { Component, inject, Input } from '@angular/core';
import { IonIcon, ModalController } from '@ionic/angular/standalone';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';

import { RunnerLesson } from '../../lessons/runner-lessons.data';
import { RunnerLessonComponent } from '../runner-lesson/runner-lesson.component';

/**
 * La lección de un patrón dentro de una ventana: se abre tras fallar un ejercicio para volver a ver el patrón en el
 * tablero pequeño. Se cierra con la equis o tocando fuera; al terminar la animación se queda la última imagen.
 */
@Component({
  selector: 'app-runner-lesson-modal',
  standalone: true,
  imports: [IonIcon, RunnerLessonComponent, TranslocoPipe],
  template: `
    <div class="flex flex-col items-center gap-4 p-4" data-testid="lesson-modal">
      <div class="flex w-full items-center justify-between gap-2">
        <span class="badge badge-primary badge-lg min-w-0 truncate font-bold" data-testid="lesson-modal-title">{{ title }}</span>
        <button class="btn btn-ghost btn-sm btn-circle" (click)="close()" [attr.aria-label]="'CHESS_RUNNER.lessonClose' | transloco"
          data-testid="lesson-modal-close">
          <ion-icon name="close-outline" class="h-5 w-5"></ion-icon>
        </button>
      </div>
      <app-runner-lesson [lesson]="lesson" (failed)="close()"></app-runner-lesson>
    </div>
  `,
})
export class RunnerLessonModalComponent {
  private modalController = inject(ModalController);

  @Input({ required: true }) lesson!: RunnerLesson;
  /** El nombre del patrón, ya traducido. */
  @Input() title = '';

  constructor() {
    addIcons({ closeOutline });
  }

  close(): void {
    void this.modalController.dismiss();
  }
}
