// core and third party libraries
import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Store, select } from '@ngrx/store';

// rxjs

// states
import { AuthState } from '@redux/states/auth.state';

// actions
import { setProfile, requestUpdateProfile, updateProfile } from '@redux/actions/auth.actions';

// selectors
import { getProfile } from '@redux/selectors/auth.selectors';


// models
import { User as FirebaseUser } from 'firebase/auth';
import { Profile } from '@models/profile.model';
import { PlanTypes } from '@models/plan.model';

// services
import { FirestoreService } from '@services/firestore.service';
import { AppService } from '@services/app.service';

// components

// utils
import { calculateElo } from '@utils/calculate-elo';


@Injectable({
  providedIn: 'root'
})
export class ProfileService {

  private profile: Profile;

  constructor(
    private store: Store<AuthState>,
    private appService: AppService,
    private translateService: TranslateService,
    private firestoreService: FirestoreService
  ) { }

  get getProfile(): Profile {
    return this.profile;
  }

  /** Elos */
  get eloPuzzles(): number {
    return this.profile?.eloPuzzles || 1500;
  }

  public getElosThemesByPlanType(planType: PlanTypes): { [key: string]: number } {
    const elos = this.profile?.elos && this.profile?.elos[planType] ? this.profile?.elos[planType] : {};
    // se filtra solo para devolver los temas que existan en la lista de la app
    const themesList = this.appService.getThemesPuzzlesList;
    let filteredElos: { [key: string]: number };

    Object.keys(elos).forEach(key => {
      if (themesList.find(theme => theme.value === key)) {
        filteredElos = { ...filteredElos, [key]: elos[key] };
      }
    });

    return filteredElos;

  }

  public getEloTotalByPlanType(planType: PlanTypes): number {
    return this.profile?.elos && this.profile?.elos[`${planType}Total`] ? this.profile?.elos[`${planType}Total`] : 1500;
  }

  public getElosOpeningsByPlanType(planType: PlanTypes): { [key: string]: number } {
    const openings = this.profile?.elos && this.profile?.elos[`${planType}Openings`] ? this.profile?.elos[`${planType}Openings`] : {};
    const openingsList = this.appService.getOpeningsList;
    let filteredOpenings: { [key: string]: number } = {};

    Object.keys(openings).forEach(key => {
      if (openingsList.find(opening => opening.value === key)) {
        filteredOpenings = { ...filteredOpenings, [key]: openings[key] };
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
    } else {
      this.profile = { ...this.profile, ...profile };
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
    const action = setProfile({ profile: null });
    this.store.dispatch(action);
  }

  /**
   * Update profile
   *
   * @param changes
   */
  updateProfile(changes: Partial<Profile>): Promise<void> {
    this.profile = {
      ...this.profile,
      ...changes
    };
    return this.firestoreService.updateProfile(changes);
  }


  /**
   * Verifica si un nickname esta disponible o no
   *
   * @param nickname string
   */
  checkNickNameExist(nickname: string): Promise<string[]> {
    return this.firestoreService.checkNickname(nickname);
  }


  addNewNickName(nickname: string, uidUser: string) {
    return this.firestoreService.addNewNickName(nickname, uidUser);
  }

  calculateEloPuzzlePlan(
    puzzleElo: number, result: 1 | 0.5 | 0,
    planType: PlanTypes,
    themes: string[],
    openingFamily: string,
  ) {

    const elos = this.profile?.elos ? { ...this.profile.elos } : {};
    let eloOpening = 1500;

    if (this.profile?.elos) {
      // Copia profunda para el planType específico, evitando la mutación directa
      elos[planType] = { ...(elos[planType] || {}) };

      if (openingFamily && this.profile.elos[`${planType}Openings`]) {
        eloOpening = calculateElo(this.profile.elos[`${planType}Openings`][openingFamily] || 1500, puzzleElo, result);
      }
    } else {
      eloOpening = calculateElo(1500, puzzleElo, result);
    }

    themes.forEach(theme => {
      if (!elos[planType]) {
        elos[planType] = {}; // Crea planType si no existe
      }
      elos[planType][theme] = calculateElo((elos[planType] && elos[planType][theme]) || 1500, puzzleElo, result);
    });

    // calcular el elo total del plan, con el parámetro del perfil
    const currentTotalElo = this.profile?.elos && this.profile?.elos[`${planType}Total`] ? this.profile?.elos[`${planType}Total`] : 1500;
    const newTotalElo = calculateElo(currentTotalElo, puzzleElo, result);
    // Inicializa el objeto de cambios con una copia de los elos existentes para evitar la sobrescritura
    const changes = { elos: { ...elos } };

    // Actualiza específicamente para el tipo de plan y aperturas, haciendo merge adecuado
    changes.elos[planType] = { ...changes.elos[planType], ...elos[planType] };

    // Actualiza el total del plan con el nuevo valor en el parámetro correspondiente al plan
    changes.elos[`${planType}Total`] = newTotalElo;

    if (openingFamily) {
      changes.elos[`${planType}Openings`] = {
        ...(changes.elos[`${planType}Openings`] || {}),
        [openingFamily]: eloOpening
      };
    }
    // se actualiza el perfil con los cambios
    this.requestUpdateProfile(changes);
  }


  private async setInitialProfile(dataAuth: FirebaseUser) {

    const profileForSet: Profile = {
      uid: dataAuth.uid,
      email: dataAuth.email,
      elo: 1500,
      lang: this.translateService.currentLang || 'en',
      createAt: new Date().getTime()
    };

    await this.firestoreService.createProfile(profileForSet);
    this.setProfile(profileForSet);

  }


}
