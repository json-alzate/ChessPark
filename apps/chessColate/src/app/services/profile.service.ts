// core and third party libraries
import { Injectable } from '@angular/core';
import { Store, select } from '@ngrx/store';

// rxjs
import { Observable } from 'rxjs';

// states
import { 
  AuthState, 
  setProfile, 
  requestUpdateProfile, 
  updateProfile,
  getProfile,
  IProfileService 
} from '@cpark/state';

// models
import { Profile, PlanTypes } from '@cpark/models';
import { User as FirebaseUser } from 'firebase/auth';


// services
import { FirestoreService } from './firestore.service';
import { AppService } from './app.service';
import { LanguageService } from './language.service';

// utils
// import { calculateElo } from '@utils/calculate-elo';

@Injectable({
  providedIn: 'root'
})
export class ProfileService implements IProfileService {

  private profile: Profile | null = null;
  
  // Observable para suscribirse al perfil desde componentes
  public profile$: Observable<Profile | null>;

  constructor(
    private store: Store<AuthState>,
    private appService: AppService,
    private firestoreService: FirestoreService,
    private languageService: LanguageService
  ) {
    // Inicializar el observable del perfil
    this.profile$ = this.store.pipe(select(getProfile));
    
    // Suscribirse internamente para mantener la propiedad profile actualizada
    this.profile$.subscribe(profile => {
      this.profile = profile;
    });
  }

  get getProfile(): Profile | null {
    return this.profile;
  }

  /** Elos */
  get eloPuzzles(): number {
    return this.profile?.eloPuzzles || 1500;
  }

  public getElosThemesByPlanType(planType: PlanTypes): { [key: string]: number } {
    // Los planes personalizados no tienen elos en el perfil
    if (planType === 'custom' || !this.profile?.elos) {
      return {};
    }

    const elos = this.profile.elos[planType as keyof typeof this.profile.elos];
    const elosObj = (elos && typeof elos === 'object' && !Array.isArray(elos)) ? elos : {};
    
    // se filtra solo para devolver los temas que existan en la lista de la app
    const themesList = this.appService.getThemesPuzzlesList;
    let filteredElos: { [key: string]: number } = {};

    Object.keys(elosObj).forEach(key => {
      if (themesList.find(theme => theme.value === key)) {
        filteredElos = { ...filteredElos, [key]: elosObj[key] };
      }
    });

    return filteredElos;
  }

  public getEloTotalByPlanType(planType: PlanTypes): number {
    // Los planes personalizados no tienen elos en el perfil
    if (planType === 'custom' || !this.profile?.elos) {
      return 1500;
    }

    const totalKey = `${planType}Total` as keyof typeof this.profile.elos;
    const total = this.profile.elos[totalKey];
    return (typeof total === 'number') ? total : 1500;
  }

  public getElosOpeningsByPlanType(planType: PlanTypes): { [key: string]: number } {
    // Los planes personalizados no tienen elos en el perfil
    if (planType === 'custom' || !this.profile?.elos) {
      return {};
    }

    const openingsKey = `${planType}Openings` as keyof typeof this.profile.elos;
    const openings = this.profile.elos[openingsKey];
    const openingsObj = (openings && typeof openings === 'object' && !Array.isArray(openings)) ? openings : {};
    const openingsList = this.appService.getOpeningsList;
    let filteredOpenings: { [key: string]: number } = {};

    Object.keys(openingsObj).forEach(key => {
      if (openingsList.find(opening => opening.value === key)) {
        filteredOpenings = { ...filteredOpenings, [key]: openingsObj[key] };
      }
    });

    return filteredOpenings;
  }

  // subscribe to profile
  subscribeToProfile() {
    return this.store.pipe(select(getProfile));
  }

  /**
   * Valida si el perfil existe en la BD y lo lleva al estado redux.
   * Sino existe se inicia el proceso para registrar el perfil en la BD
   *
   * @param dataAuth
   */
  async checkProfile(dataAuth: FirebaseUser) {
    const profile = await this.firestoreService.getProfile(dataAuth?.uid);
    if (profile) {
      this.setProfile(profile);
    } else {
      this.setInitialProfile(dataAuth);
    }
  }

  // request update profile
  requestUpdateProfile(profile: Partial<Profile>) {
    if (this.profile?.uid) {
      const action = requestUpdateProfile({ profile });
      this.store.dispatch(action);
    } else if (this.profile) {
      this.profile = { ...this.profile, ...profile } as Profile;
      const action = updateProfile({ profile });
      this.store.dispatch(action);
    }
  }

  // set profile
  setProfile(profile: Profile) {
    this.profile = profile;
    const action = setProfile({ profile });
    this.store.dispatch(action);
  }

  // clear profile
  clearProfile() {
    this.profile = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const action = setProfile({ profile: null as any });
    this.store.dispatch(action);
  }

  /**
   * Update profile
   *
   * @param changes
   */
  async updateProfile(changes: Partial<Profile>): Promise<void> {
    if (this.profile) {
      this.profile = {
        ...this.profile,
        ...changes
      } as Profile;
    }
    return this.firestoreService.updateProfile(changes);
  }

  /**
   * Verifica si un nickname esta disponible o no
   *
   * @param nickname string
   */
  checkNickNameExist(_nickname: string): Promise<string[]> {
    return this.firestoreService.checkNickname(_nickname);
  }

  addNewNickName(_nickname: string, _uidUser: string): Promise<void> {
    return this.firestoreService.addNewNickName(_nickname, _uidUser).then(() => {}).catch(() => { throw new Error('Error al agregar nuevo nickname'); });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async setInitialProfile(dataAuth: any) {
    const profileForSet: Profile = {
      uid: dataAuth.uid,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      email: dataAuth.email!,
      elo: 1500,
      lang: this.languageService.getCurrentLang(),
      createAt: new Date().getTime()
    };

    await this.firestoreService.createProfile(profileForSet);
    this.setProfile(profileForSet);
  }
}
