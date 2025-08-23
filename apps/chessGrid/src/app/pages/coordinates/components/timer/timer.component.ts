import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-timer',
  templateUrl: './timer.component.html',
  styleUrls: ['./timer.component.scss'],
  standalone: true,
  imports: [CommonModule],
})
export class TimerComponent {
  @Input() time = 60;
  @Input() progressValue = 1;
  @Input() timeColor: 'success' | 'warning' | 'danger' = 'success';
}
