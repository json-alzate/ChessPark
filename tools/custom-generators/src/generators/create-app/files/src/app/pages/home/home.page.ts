import { Component } from '@angular/core';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent } from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent, CommonModule],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-title>
          <%= classifyName %>
        </ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large"><%= classifyName %></ion-title>
        </ion-toolbar>
      </ion-header>

      <div class="container">
        <h1>¡Bienvenido a <%= classifyName %>!</h1>
        <p>Esta es una aplicación Angular con Ionic, Capacitor y Tailwind CSS.</p>
        
        <ion-card>
          <ion-card-header>
            <ion-card-title>Características</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ul>
              <li>Angular standalone components</li>
              <li>Ionic Framework</li>
              <li>Capacitor para móvil</li>
              <li>Tailwind CSS</li>
              <li>DaisyUI</li>
              <li>Swiper carousel</li>
              <li>Service Worker</li>
            </ul>
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>
  `,
  styles: [``]
})
export class HomePage {
  constructor() {}
}
