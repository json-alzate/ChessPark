import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { initializeApp } from 'firebase/app';
import { Subscription } from 'rxjs';

// Ionic imports
import { IonMenu, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonIcon, IonLabel, IonRouterOutlet, IonButtons, IonButton, IonAvatar, IonMenuToggle, ModalController } from '@ionic/angular/standalone';

// Transloco
import { TranslocoPipe } from '@jsverse/transloco';

// Services
import { AuthService } from '@services/auth.service';
import { ProfileService } from '@services/profile.service';
import { FirestoreService } from '@services/firestore.service';

// Models
import { Profile } from '@cpark/models';

// RxJS
import { switchMap } from 'rxjs/operators';

// Environment
import { environment } from '@environments/environment';
import { LoginComponent } from '@shared/components/login/login.component';

interface MenuOption {
  title: string;
  icon: string;
  route: string;
  enabled: boolean;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  icon: string;
  color: string;
  time: string;
  read: boolean;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [IonAvatar,
    IonMenu,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonIcon,
    IonLabel,
    IonRouterOutlet,
    IonButtons,
    IonButton,
    TranslocoPipe, IonMenuToggle],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'chess-colate';

  router = inject(Router);
  authService = inject(AuthService);
  profileService = inject(ProfileService);
  firestoreService = inject(FirestoreService);
  modalController = inject(ModalController);
  // Datos del usuario
  profile: Profile | null = null;
  isAuthenticated = false;
  displayName = '';
  displayEmail = '';
  photoURL = '';
  version = environment.version;

  // Opciones del menú
  menuOptions: MenuOption[] = [
    {
      title: 'Inicio',
      icon: 'home-outline',
      route: '/home',
      enabled: true
    },
  ];

  // Notificaciones
  notifications: Notification[] = [
    // {
    //   id: '1',
    //   title: 'Nuevo puzzle disponible',
    //   message: 'Se ha agregado un nuevo puzzle de nivel intermedio',
    //   icon: 'extension-puzzle-outline',
    //   color: 'primary',
    //   time: 'Hace 2 horas',
    //   read: false
    // },

  ];

  private profileSubscription?: Subscription;

  constructor() {
    this.initApp();
  }

  ngOnInit(): void {
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
  }

  async initApp() {
    // Inicializar Firebase
    await this.initFirebase();
  }

  async initFirebase() {
    // Inicializar Firebase
    initializeApp(environment.firebase);
    
    // Inicializar el servicio de autenticación
    await this.authService.init();
    
    // Inicializar Firestore
    await this.firestoreService.init();
    
    // Escuchar el estado del usuario - login/logout
    this.authService.getAuthState().pipe(
      switchMap(async (dataAuth) => {
        console.log('Auth state changed:', dataAuth);
        
        if (dataAuth) {
          // Usuario autenticado - obtener o crear perfil
          await this.profileService.checkProfile(dataAuth);
        } else {
          // Usuario no autenticado - limpiar perfil
          this.profileService.clearProfile();
        }
        
        // Marcar como inicializado después de procesar el perfil
        this.authService.markAsInitialized();
        return dataAuth;
      })
    ).subscribe();
  }

  /**
   * Trunca el email si es muy largo
   */
  truncateEmail(email: string): string {
    if (!email) return '';
    if (email.length > 25) {
      return email.substring(0, 22) + '...';
    }
    return email;
  }

  /**
   * Obtiene las iniciales del nombre o email
   */
  getInitials(): string {
    if (this.displayName) {
      const names = this.displayName.split(' ');
      if (names.length >= 2) {
        return (names[0].charAt(0) + names[1].charAt(0)).toUpperCase();
      }
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

  /**
   * Navega a una ruta específica
   */
  navigateTo(route: string) {
    this.router.navigate([route]);
  }

  /**
   * Cierra la sesión del usuario
   */
  logout() {
    this.authService.logout().subscribe(() => {
      console.log('Sesión cerrada');
      this.router.navigate(['/home']);
    });
  }

  /**
   * Marca una notificación como leída
   */
  markAsRead(notificationId: string) {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
    }
  }

  /**
   * Marca todas las notificaciones como leídas
   */
  markAllAsRead() {
    this.notifications.forEach(notification => {
      notification.read = true;
    });
  }

  /**
   * Cierra el menú de notificaciones
   */
  closeNotificationsMenu() {
    // Esta función se puede usar para cerrar el menú programáticamente si es necesario
    console.log('Cerrando menú de notificaciones');
  }
}
