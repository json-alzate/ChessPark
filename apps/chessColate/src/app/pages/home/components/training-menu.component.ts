import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';

import { addIcons } from 'ionicons';
import { timerOutline} from 'ionicons/icons';

@Component({
  selector: 'app-training-menu',
  imports: [CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './training-menu.component.html',
  styleUrl: './training-menu.component.scss',
})
export class TrainingMenuComponent {
  constructor() {
    addIcons({ timerOutline });
  }
}
