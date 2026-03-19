import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { initializeApp } from 'firebase/app';
import { Subscription } from 'rxjs';

// Ionic imports
import { addIcons } from 'ionicons';
import {
  homeOutline,
  gridOutline,
  extensionPuzzleOutline,
  shuffleOutline,
  timeOutline,
  heartOutline,
  logOutOutline,
  closeOutline,
  checkmarkDoneOutline,
  notificationsOffOutline,
  checkmarkOutline
} from 'ionicons/icons';
import {
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
  IonAvatar,
  IonMenuToggle,
  ModalController,
  MenuController,
} from '@ionic/angular/standalone';

// Transloco
import { TranslocoPipe } from '@jsverse/transloco';

// Services
import { AuthService } from '@services/auth.service';
import { ProfileService } from '@services/profile.service';
import { FirestoreService } from '@services/firestore.service';
import { RevenueCatService, LogLevel } from '@chesspark/revenuecat';
import { Capacitor } from '@capacitor/core';

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
  imports: [
    IonAvatar,
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
    TranslocoPipe,
    IonMenuToggle,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'chess-colate';

  router = inject(Router);
  authService = inject(AuthService);
  profileService = inject(ProfileService);
  firestoreService = inject(FirestoreService);
  revenueCat = inject(RevenueCatService);
  modalController = inject(ModalController);
  menuController = inject(MenuController);
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
      enabled: true,
    },
    {
      title: 'Coordenadas',
      icon: 'grid-outline',
      route: '/coordinates',
      enabled: true,
    },
    {
      title: 'Recorrido del Caballo',
      icon: 'extension-puzzle-outline',
      route: '/knight-tour',
      enabled: true,
    },
    {
      title: 'Ajedrez 960',
      icon: 'shuffle-outline',
      route: '/chess960',
      enabled: true,
    },
    {
      title: 'Historial de Planes',
      icon: 'time-outline',
      route: '/puzzles/plans-history',
      enabled: true,
    },
    {
      title: 'Donar',
      icon: 'heart-outline',
      route: '/donation',
      enabled: true,
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
    addIcons({
      'home-outline': homeOutline,
      'grid-outline': gridOutline,
      'extension-puzzle-outline': extensionPuzzleOutline,
      'shuffle-outline': shuffleOutline,
      'time-outline': timeOutline,
      'heart-outline': heartOutline,
      'log-out-outline': logOutOutline,
      'close-outline': closeOutline,
      'checkmark-done-outline': checkmarkDoneOutline,
      'notifications-off-outline': notificationsOffOutline,
      'checkmark-outline': checkmarkOutline
    });
    this.initApp();
  }

  ngOnInit(): void {
    // Suscribirse al perfil del usuario
    this.profileSubscription = this.profileService.profile$.subscribe(
      (profile) => {
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
      }
    );
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

    // Inicializar RevenueCat (solo en plataformas nativas)
    await this.initRevenueCat();

    // Escuchar el estado del usuario - login/logout
    this.authService
      .getAuthState()
      .pipe(
        switchMap(async (dataAuth) => {
          console.log('Auth state changed:', dataAuth);

          if (dataAuth) {
            // Usuario autenticado - obtener o crear perfil
            await this.profileService.checkProfile(dataAuth);
            // Reconfigurar RevenueCat con el nuevo user ID
            await this.configureRevenueCatUser(dataAuth.uid);
          } else {
            // Usuario no autenticado - limpiar perfil
            await this.profileService.clearProfile();
          }

          // Marcar como inicializado después de procesar el perfil
          this.authService.markAsInitialized();
          return dataAuth;
        })
      )
      .subscribe();
  }

  /**
   * Inicializa RevenueCat
   */
  async initRevenueCat() {
    try {
      // Obtener API Key de RevenueCat desde environment
      const revenueCatApiKey = (environment as any).revenueCatApiKey || '';

      if (!revenueCatApiKey) {
        console.warn('RevenueCat API Key no configurada en environment');
        return;
      }

      // Obtener el user ID del usuario autenticado si existe
      const userId = this.profile?.uid || undefined;

      // Inicializar RevenueCat (funciona tanto en web como móvil)
      // En web usará API REST, en móvil usará SDK nativo
      await this.revenueCat.initialize(revenueCatApiKey, userId);

      // Configurar logging en desarrollo (solo en móvil)
      if (!environment.production && Capacitor.isNativePlatform()) {
        this.revenueCat.setLogLevel(LogLevel.DEBUG);
      }

      if (Capacitor.isNativePlatform()) {
        console.log('RevenueCat inicializado correctamente (SDK nativo)');
      } else {
        console.log(
          'RevenueCat inicializado correctamente (API REST para web)'
        );
      }
    } catch (error: unknown) {
      console.error('Error al inicializar RevenueCat:', error);
    }
  }

  /**
   * Configura el usuario en RevenueCat cuando se autentica
   */
  async configureRevenueCatUser(userId: string) {
    try {
      if (this.revenueCat) {
        // Configurar usuario (funciona tanto en web como móvil)
        await this.revenueCat.configure(userId);
        console.log('RevenueCat configurado para usuario:', userId);

        // Verificar si el usuario tiene una suscripción activa (donación recurrente)
        // Usar el entitlement ID configurado en RevenueCat Dashboard
        // Por defecto usamos 'donation' pero puede ser cualquier ID configurado
        const entitlementId = 'donation'; // Cambiar según el entitlement ID configurado en RevenueCat

        try {
          const isSubscribed = await this.revenueCat.checkSubscriptionStatus(
            entitlementId
          );

          if (isSubscribed) {
            console.log('Usuario tiene suscripción activa:', entitlementId);
            // Aquí puedes actualizar el estado del usuario o el perfil si es necesario
            // Por ejemplo: this.profileService.updateSubscriptionStatus(true);
          } else {
            console.log('Usuario no tiene suscripción activa');
          }
        } catch (subscriptionError: unknown) {
          // No bloquear el flujo si hay error al verificar suscripción
          console.warn('Error al verificar suscripción:', subscriptionError);
        }
      }
    } catch (error: unknown) {
      console.error('Error al configurar usuario en RevenueCat:', error);
    }
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
    this.modalController
      .create({
        component: LoginComponent,
        componentProps: {
          segmentEmailPassword: 'login',
        },
      })
      .then((modal) => modal.present());
  }

  /**
   * Navega a una ruta específica y cierra el menú lateral
   */
  navigateTo(route: string) {
    this.router.navigate([route]).then(() => {
      this.menuController.close('side-menu');
    });
  }

  /**
   * Cierra la sesión del usuario y cierra el menú lateral
   */
  logout() {
    this.authService.logout().subscribe(() => {
      console.log('Sesión cerrada');
      this.router.navigate(['/home']).then(() => {
        this.menuController.close('side-menu');
      });
    });
  }

  /**
   * Marca una notificación como leída
   */
  markAsRead(notificationId: string) {
    const notification = this.notifications.find(
      (n) => n.id === notificationId
    );
    if (notification) {
      notification.read = true;
    }
  }

  /**
   * Marca todas las notificaciones como leídas
   */
  markAllAsRead() {
    this.notifications.forEach((notification) => {
      notification.read = true;
    });
  }

  /**
   * Cierra el menú de notificaciones
   */
  closeNotificationsMenu() {
    this.menuController.close('notifications-menu');
  }
}
