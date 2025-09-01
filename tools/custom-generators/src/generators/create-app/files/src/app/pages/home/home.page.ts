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
        <p>Esta es una aplicación Angular con Ionic y Angular Elements.</p>
        
        <ion-card>
          <ion-card-header>
            <ion-card-title>Características</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ul>
              <li>Angular standalone components</li>
              <li>Ionic Framework</li>
              <% if (hasElements) { %><li>Angular Elements</li><% } %>
              <% if (hasCapacitor) { %><li>Capacitor para móvil</li><% } %>
              <% if (hasTailwind) { %><li>Tailwind CSS</li><% } %>
              <% if (hasDaisyUI) { %><li>DaisyUI</li><% } %>
              <% if (hasNgRx) { %><li>NgRx Store</li><% } %>
              <% if (hasSwiper) { %><li>Swiper carousel</li><% } %>
            </ul>
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>
  `,
  styles: [`
    .container {
      padding: 20px;
      text-align: center;
    }
    
    h1 {
      color: var(--ion-color-primary);
      margin-bottom: 20px;
    }
    
    p {
      font-size: 18px;
      margin-bottom: 30px;
    }
    
    ion-card {
      max-width: 600px;
      margin: 0 auto;
    }
    
    ul {
      text-align: left;
      padding-left: 20px;
    }
    
    li {
      margin-bottom: 10px;
      font-size: 16px;
    }
  `]
})
export class HomePage {
  constructor() {}
}
