import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalController, MenuController } from '@ionic/angular/standalone';
import { Subscription } from 'rxjs';

import { LoginComponent } from '../login/login.component';
import { ProfileService } from '@services/profile.service';
import { AuthService } from '@services/auth.service';
import { Profile } from '@cpark/models';
import { Store, select } from '@ngrx/store';
import { AuthState, getIsInitialized } from '@cpark/state';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
})
export class NavbarComponent implements OnInit, OnDestroy {

  modalController = inject(ModalController);
  menuController = inject(MenuController);
  profileService = inject(ProfileService);
  authService = inject(AuthService);
  store = inject(Store<AuthState>);

  profile: Profile | null = null;
  isAuthenticated = false;
  isInitialized = false;
  displayName = '';
  displayEmail = '';
  photoURL = '';

  private profileSubscription?: Subscription;
  private initSubscription?: Subscription;

  ngOnInit(): void {
    // Suscribirse al estado de inicialización desde Redux
    this.initSubscription = this.store.pipe(select(getIsInitialized)).subscribe(initialized => {
      this.isInitialized = initialized;
    });

    // Suscribirse al perfil del usuario
    this.profileSubscription = this.profileService.profile$.subscribe(profile => {
      this.profile = profile;
      this.isAuthenticated = !!profile;
      
      if (profile) {
        this.displayName = profile.name || '';
        this.displayEmail = this.truncateEmail(profile.email);
        this.photoURL = ''; // Firebase user photoURL puede agregarse al Profile model
      } else {
        this.displayName = '';
        this.displayEmail = '';
        this.photoURL = '';
      }
    });
  }

  ngOnDestroy(): void {
    this.profileSubscription?.unsubscribe();
    this.initSubscription?.unsubscribe();
  }

  /**
   * Trunca el email si es muy largo
   */
  truncateEmail(email: string): string {
    if (!email) return '';
    if (email.length > 20) {
      return email.substring(0, 17) + '...';
    }
    return email;
  }

  /**
   * Obtiene las iniciales del nombre o email
   */
  getInitials(): string {
    if (this.displayName) {
      return this.displayName.charAt(0).toUpperCase();
    }
    if (this.displayEmail) {
      return this.displayEmail.charAt(0).toUpperCase();
    }
    return '?';
  }

  openLoginModal() {
    this.modalController.create({
      component: LoginComponent,
      componentProps: {
        segmentEmailPassword: 'login'
      }
    }).then(modal => modal.present());
  }


  logout() {
    this.authService.logout().subscribe(() => {
      console.log('Sesión cerrada');
    });
  }

  /**
   * Abre el menú lateral
   */
  openSideMenu() {
    this.menuController.open('side-menu');
  }

  /**
   * Abre el menú de notificaciones
   */
  openNotificationsMenu() {
    this.menuController.open('notifications-menu');
  }
}
