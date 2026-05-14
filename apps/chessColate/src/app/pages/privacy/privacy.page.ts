import { Component } from '@angular/core';
import { Router } from '@angular/router';

import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { homeOutline } from 'ionicons/icons';

import { NavbarComponent } from '@shared/components/navbar/navbar.component';

addIcons({ homeOutline });

@Component({
  selector: 'app-privacy',
  templateUrl: './privacy.page.html',
  styleUrls: ['./privacy.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon, NavbarComponent],
})
export class PrivacyPage {
  constructor(private router: Router) {}

  goToHome() {
    this.router.navigate(['/home']);
  }
}
