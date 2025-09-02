import { Component, OnInit, Input } from '@angular/core';

import { interval, Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-block-presentation',
  templateUrl: './block-presentation.component.html',
  styleUrls: ['./block-presentation.component.scss'],
})
export class BlockPresentationComponent implements OnInit {

  @Input() title: string;
  @Input() description: string;
  @Input() image: string;

  timer = 5;
  timer$: Observable<number>;
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
    this.timer$ = null;
    this.timerUnsubscribe$.next();
    this.timerUnsubscribe$.complete();
  }

}
