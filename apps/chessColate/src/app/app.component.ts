// core and third party libraries
import { Component } from '@angular/core';
import { Store, select } from '@ngrx/store';
import { TranslateService } from '@ngx-translate/core';
import { ModalController, Platform, isPlatform, NavController, MenuController } from '@ionic/angular';
import { Device } from '@capacitor/device';
// import { Socket } from 'ngx-socket-io';
import { initializeApp } from 'firebase/app';
import { environment } from '@environments/environment';
import { register } from 'swiper/element/bundle';

register();




// rxjs
import { Subject, Observable } from 'rxjs';


// states
import { AuthState } from '@redux/states/auth.state';

// actions

// selectors
import { getProfile } from '@redux/selectors/auth.selectors';

// models
import { User as FirebaseUser } from 'firebase/auth';
import { Profile } from '@models/profile.model';

// services
import { FirestoreService } from '@services/firestore.service';
import { AuthService } from '@services/auth.service';
import { ProfileService } from '@services/profile.service';
import { FcmService } from '@services/fcm.service';
import { ToolsService } from '@services/tools.service';
import { UiService } from '@services/ui.service';
import { AppService } from '@services/app.service';

// components
import { LoginComponent } from '@shared/components/login/login.component';
import { OnboardingComponent } from '@shared/components/onboarding/onboarding.component';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent {

  profile$: Observable<Profile>;
  showProfile: boolean;
  version = environment.version;
  currentLang: string;

  constructor(
    private modalController: ModalController,
    private translateService: TranslateService,
    private authService: AuthService,
    private profileService: ProfileService,
    private platform: Platform,
    private firestoreService: FirestoreService,
    private store: Store<AuthState>,
    private fcmService: FcmService,
    private toolsService: ToolsService,
    private navController: NavController,
    private menuController: MenuController,
    private uiService: UiService,
    private appService: AppService
  ) {

    this.initApp();
    this.getLang();
    // Se escuchan los datos del usuario desde el store
    this.profile$ = this.store.pipe(
      select(getProfile)
    );

    this.profile$.subscribe((profile: Profile) => {
      // if (profile?.email && !profile.name) {
      //   this.presentModalOnboarding();
      // }
      if (profile?.lang) {
        this.getLang(profile?.lang);
      }
      if (profile?.pieces) {
        this.uiService.changePiecesStyle(profile.pieces);
      }
      if (profile?.board) {
        this.uiService.changeBoardStyle(profile.board);
      }
    });

  }

  async initApp() {

    this.initFirebase();
    this.appService.loadThemesPuzzle();
    this.appService.loadOpenings();
    this.toolsService.loadFlags();
    // this.fcmService.initPush();
  }

  async initFirebase() {
    initializeApp(environment.firebase);
    await this.authService.init();
    await this.firestoreService.init();
    // se obtiene el estado del usuario -login-
    this.authService.getAuthState().subscribe((dataAuth: FirebaseUser) => {
      // se obtienen los datos del usuario, sino existe se crea el nuevo usuario
      if (dataAuth) {
        this.profileService.checkProfile(dataAuth);
      } else {
        this.profileService.clearProfile();
      }
    });
  }

  /**
   * Se obtiene el idioma
   */
  async getLang(langToUse?: string) {

    if (langToUse) {
      this.translateService.use(langToUse);
      this.currentLang = langToUse;
    } else {
      const lang = await Device.getLanguageCode();
      if (lang.value.slice(0, 2) === 'en') {
        this.translateService.use('en');
        this.currentLang = 'en';
      }
    }


  }

  async presentModalLogin() {
    const modal = await this.modalController.create({
      component: LoginComponent,
      componentProps: { showAs: 'modal' },
    });
    await modal.present();
  }

  // async presentModalOnboarding() {
  //   const modal = await this.modalController.create({
  //     component: OnboardingComponent,
  //     backdropDismiss: false,
  //     cssClass: 'modal-onboarding'
  //   });

  //   await modal.present();

  // }
  goTo(path) {
    this.navController.navigateRoot(path);
  }

  closeMenu() {
    this.menuController.close('menu-profile');
  }

  onLogout() {
    this.authService.triggerLogout();
    this.showProfile = false;
    this.menuController.close('menu-profile');
  }

}
