// Angular
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
// Ionic
import { IonContent } from '@ionic/angular/standalone';

// Components
import { NavbarComponent } from '@shared/components/navbar/navbar.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    IonContent,
    CommonModule,
    NavbarComponent
  ],
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {
  constructor() {}
}
