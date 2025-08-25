import { Component, Input, Output, EventEmitter, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonToggle,
  IonFooter,
  IonButton,
  IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline, stopOutline, settingsOutline } from 'ionicons/icons';

addIcons({ closeOutline, stopOutline, settingsOutline });

export interface GameSettings {
  showCoordinates: boolean;
  showPieces: boolean;
  infiniteMode: boolean;
}

@Component({
  selector: 'app-settings-side-menu',
  templateUrl: './settings-side-menu.component.html',
  styleUrls: ['./settings-side-menu.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonModal,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonToggle,
    IonFooter,
    IonButton,
    IonIcon,
  ],
})
export class SettingsSideMenuComponent {
  @ViewChild(IonModal) modal!: IonModal;
  
  @Input() settings: GameSettings = {
    showCoordinates: false,
    showPieces: false,
    infiniteMode: false,
  };

  @Input() isPlaying = false;
  @Input() appVersion = 'v1.0.0';

  @Output() settingsChange = new EventEmitter<GameSettings>();
  @Output() stopGame = new EventEmitter<void>();

  onSettingChange(setting: keyof GameSettings, value: boolean) {
    const newSettings = { ...this.settings, [setting]: value };
    this.settingsChange.emit(newSettings);
  }

  onStopGame() {
    this.stopGame.emit();
  }

  present() {
    this.modal.present();
  }

  dismiss() {
    this.modal.dismiss();
  }
}
