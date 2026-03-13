import { Component, Input, Output, EventEmitter, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonModal,
  IonTitle,
  IonToolbar,
  IonHeader,
  IonFooter,
  IonContent,
  IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { trophy, informationCircle, checkmark, podium, medal } from 'ionicons/icons';
import { TranslocoPipe } from '@jsverse/transloco';

addIcons({ trophy, informationCircle, checkmark, podium, medal });

@Component({
  selector: 'app-game-results-modal',
  templateUrl: './game-results-modal.component.html',
  styleUrls: ['./game-results-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonModal,
    IonTitle,
    IonToolbar,
    IonHeader,
    IonFooter,
    IonContent,
    IonIcon,
    TranslocoPipe,
  ],
})
export class GameResultsModalComponent {
  @ViewChild(IonModal) modal!: IonModal;
  
  @Input() isNewRecord = false;
  @Input() recordType: 'color' | 'overall' | 'both' | null = null;
  @Input() score = 0;
  @Input() squaresGood: string[] = [];
  @Input() squaresBad: string[] = [];
  @Input() currentColorInBoard: 'white' | 'black' = 'white';
  @Input() currentGameStats = {
    correctAnswers: 0,
    incorrectAnswers: 0,
    accuracy: 0,
  };
  @Input() bestScoreByColor = 0;

  @Output() closeModal = new EventEmitter<void>();

  present() {
    this.modal.present();
  }

  dismiss() {
    this.modal.dismiss(null, 'confirm');
  }

  onCloseModal() {
    this.closeModal.emit();
  }
}
