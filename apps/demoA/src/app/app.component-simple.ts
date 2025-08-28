import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonApp, IonContent, IonHeader, IonTitle, IonToolbar, IonButton } from '@ionic/angular/standalone';

@Component({
  selector: 'app-root-simple',
  template: `
    <ion-app>
      <ion-header>
        <ion-toolbar>
          <ion-title>DemoA App - Angular Elements</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content>
        <div style="padding: 20px;">
          <h2>¡Bienvenido a DemoA!</h2>
          <p>Esta es la versión simplificada de Angular Elements sin router.</p>
          <p>La aplicación se está ejecutando correctamente como un elemento personalizado.</p>
          
          <!-- Aquí puedes agregar más contenido o componentes -->
          <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
            <h3>Estado de la Aplicación:</h3>
            <ul>
              <li>✅ Angular Elements cargado</li>
              <li>✅ Ionic Framework funcionando</li>
              <li>✅ NgRx Store disponible</li>
              <li>✅ Componentes Xerpa UI cargados</li>
            </ul>
          </div>
          
          <div style="margin-top: 20px;">
            <ion-button (click)="showMessage()">Mostrar Mensaje</ion-button>
            <ion-button (click)="changeTheme()" fill="outline">Cambiar Tema</ion-button>
          </div>
          
          <div *ngIf="message" style="margin-top: 20px; padding: 10px; background: #d4edda; border-radius: 5px; color: #155724;">
            {{ message }}
          </div>
        </div>
      </ion-content>
    </ion-app>
  `,
  imports: [CommonModule, IonApp, IonContent, IonHeader, IonTitle, IonToolbar, IonButton],
  standalone: true
})
export class AppComponentSimple {
  message = '';

  showMessage() {
    this.message = '¡La aplicación Angular Elements está funcionando correctamente!';
    setTimeout(() => {
      this.message = '';
    }, 3000);
  }

  changeTheme() {
    // Cambiar entre tema claro y oscuro
    const body = document.body;
    if (body.classList.contains('dark')) {
      body.classList.remove('dark');
      this.message = 'Tema cambiado a modo claro';
    } else {
      body.classList.add('dark');
      this.message = 'Tema cambiado a modo oscuro';
    }
    setTimeout(() => {
      this.message = '';
    }, 2000);
  }
} 