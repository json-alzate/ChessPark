import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { initializeApp } from 'firebase/app';

// Services
import { AuthService } from '@services/auth.service';
import { ProfileService } from '@services/profile.service';
import { FirestoreService } from '@services/firestore.service';

// RxJS
import { switchMap } from 'rxjs/operators';

// Environment
import { environment } from '@environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet></router-outlet>',
})
export class AppComponent implements OnInit {
  title = 'chess-colate';

  authService = inject(AuthService);
  profileService = inject(ProfileService);
  firestoreService = inject(FirestoreService);
  constructor() {
    this.initApp();
  }

  ngOnInit() {
    // Inicialización adicional si es necesaria
  }

  async initApp() {
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
}
