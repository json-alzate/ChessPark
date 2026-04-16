import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { shuffleOutline } from 'ionicons/icons';

addIcons({ shuffleOutline });
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-board-orientation-controls',
  templateUrl: './board-orientation-controls.component.html',
  styleUrls: ['./board-orientation-controls.component.scss'],
  standalone: true,
  imports: [CommonModule, IonIcon, TranslocoPipe],
})
export class BoardOrientationControlsComponent {
  @Input() boardOrientation: 'random' | 'white' | 'black' = 'random';
  @Input() isPlaying = false;

  @Output() orientationChange = new EventEmitter<'random' | 'white' | 'black'>();

  onOrientationChange(orientation: 'random' | 'white' | 'black') {
    this.orientationChange.emit(orientation);
  }
}
