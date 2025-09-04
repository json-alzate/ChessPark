import { Component, Input, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { trophyOutline, timeOutline } from 'ionicons/icons';

addIcons({ trophyOutline, timeOutline });


@Component({
  selector: 'app-principal-slider',
  templateUrl: './principal-slider.component.html',
  styleUrls: ['./principal-slider.component.scss'],
  standalone: true,
  imports: [CommonModule, IonIcon],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class PrincipalSliderComponent {

}