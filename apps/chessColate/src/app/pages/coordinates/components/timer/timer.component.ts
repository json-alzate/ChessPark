import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { infiniteOutline } from 'ionicons/icons';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-timer',
  templateUrl: './timer.component.html',
  styleUrls: ['./timer.component.scss'],
  standalone: true,
  imports: [CommonModule, IonIcon, TranslocoPipe],
})
export class TimerComponent {
  constructor() {
    addIcons({ infiniteOutline });
  }
  @Input() time = 60;
  @Input() progressValue = 1;
  @Input() timeColor: 'success' | 'warning' | 'danger' = 'success';
  @Input() infiniteMode = false;

  get isInfiniteMode(): boolean {
    return this.time === Infinity || this.infiniteMode;
  }

  get displayTime(): string {
    if (this.isInfiniteMode) {
      return '∞';
    }
    return this.time.toFixed(0);
  }

  get displayProgress(): number {
    if (this.isInfiniteMode) {
      return 100;
    }
    return this.progressValue * 100;
  }
}
