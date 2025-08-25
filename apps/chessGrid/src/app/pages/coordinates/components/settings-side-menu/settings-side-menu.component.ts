import { Component, Input, Output, EventEmitter, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
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
  showRandomPieces: boolean;
  infiniteMode: boolean;
  playSound: boolean;
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
    showRandomPieces: false,
    playSound: false,
    infiniteMode: false,
  };
  @Input() appVersion = 'v1.0.1';

  @Output() settingsChange = new EventEmitter<GameSettings>();

  onSettingChange(setting: keyof GameSettings, value: boolean) {
    const newSettings = { ...this.settings, [setting]: value };
    
    // Si se desactiva mostrar piezas, también desactivar mostrar piezas aleatorias
    if (setting === 'showPieces' && !value) {
      newSettings.showRandomPieces = false;
    }
    
    // Si se activa mostrar piezas aleatorias, asegurar que mostrar piezas esté activado
    if (setting === 'showRandomPieces' && value) {
      newSettings.showPieces = true;
    }
    
    this.settingsChange.emit(newSettings);
  }

  onCheckboxChange(event: Event, setting: keyof GameSettings) {
    const target = event.target as HTMLInputElement;
    this.onSettingChange(setting, target?.checked || false);
  }



  dismiss() {
    this.modal.dismiss();
  }
}
