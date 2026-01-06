import { Component, OnInit, Input, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

import { interval, Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { ModalController } from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-block-presentation',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './block-presentation.component.html',
  imports: [CommonModule],
  styleUrls: ['./block-presentation.component.scss'],
})
export class BlockPresentationComponent implements OnInit {

  @Input() title!: string;
  @Input() description!: string;
  @Input() image!: string;

  timer = 5;
  timer$!: Observable<number> | undefined;
  timerUnsubscribe$ = new Subject<void>();

  // se crea una cuenta regresiva para iniciar el entrenamiento

  constructor(
    private modalController: ModalController
  ) {
    this.startCountdown();
  }

  ngOnInit() { }

  startCountdown() {
    this.timer$ = interval(1000);
    this.timer$.pipe(
      takeUntil(this.timerUnsubscribe$)
    ).subscribe(() => {
      this.timer--;
      if (this.timer === 0) {
        this.closeAndStart();
      }
    });
  }

  closeAndStart() {
    this.stopTimer();
    this.modalController.dismiss();
  }

  stopTimer() {
    this.timer$ = undefined as unknown as Observable<number>;
    this.timerUnsubscribe$.next();
    this.timerUnsubscribe$.complete();
    this.timerUnsubscribe$.unsubscribe();
  }

}
