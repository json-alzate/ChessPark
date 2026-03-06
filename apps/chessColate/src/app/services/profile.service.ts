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
import { LanguageService, SupportedLang } from './language.service';
import { EloCalculatorService } from '@chesspark/common-utils';

/**
 * Información sobre récords alcanzados en un plan por defecto
 */
export interface DefaultPlanRecordInfo {
  isNewTotalRecord: boolean;
  isNewThemeRecord: boolean;
  isNewOpeningRecord: boolean;
  newThemeRecords: string[];
  newOpeningRecord?: string;
}

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
    private languageService: LanguageService,
    private eloCalculator: EloCalculatorService
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
      await this.setProfile(profile);
    } else {
      await this.setInitialProfile(dataAuth);
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
  async setProfile(profile: Profile) {
    this.profile = profile;

    // Cambiar el idioma de la aplicación si el perfil lo tiene definido y es válido
    if (profile && profile.lang && this.languageService.isLanguageAvailable(profile.lang)) {
      await this.languageService.setLanguage(profile.lang as SupportedLang);
    }

    const action = setProfile({ profile });
    this.store.dispatch(action);
  }

  // clear profile
  async clearProfile() {
    this.profile = null;

    // Si no hay sesión, los textos deben estar en inglés
    await this.languageService.setLanguage('en');

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
    return this.firestoreService.addNewNickName(_nickname, _uidUser).then(() => { }).catch(() => { throw new Error('Error al agregar nuevo nickname'); });
  }

  /**
   * Calcula y actualiza los elos de un plan por defecto (warmup, plan1, plan3, etc.)
   * Este método actualiza los elos dentro del objeto Profile.elos
   */
  calculateEloPuzzlePlan(
    puzzleElo: number,
    result: 1 | 0.5 | 0,
    planType: PlanTypes,
    themes: string[],
    openingFamily: string,
  ): DefaultPlanRecordInfo {
    // Usar Record para permitir acceso dinámico a propiedades
    const elos: Record<string, any> = this.profile?.elos ? { ...this.profile.elos } : {};
    let eloOpening = 1500;

    const recordInfo: DefaultPlanRecordInfo = {
      isNewTotalRecord: false,
      isNewThemeRecord: false,
      isNewOpeningRecord: false,
      newThemeRecords: [],
      newOpeningRecord: undefined
    };

    if (this.profile?.elos) {
      // Copia profunda para el planType específico, evitando la mutación directa
      elos[planType] = { ...(elos[planType] || {}) };

      if (openingFamily) {
        const openingsKey = `${planType}Openings` as keyof typeof this.profile.elos;
        const openings = this.profile.elos[openingsKey] as { [key: string]: number } | undefined;
        if (openings) {
          const currentElo = openings[openingFamily] || 1500;
          eloOpening = this.eloCalculator.calculateElo(currentElo, puzzleElo, result).newElo;
        }
      }
    } else {
      eloOpening = this.eloCalculator.calculateElo(1500, puzzleElo, result).newElo;
    }

    // Inicializar máximos si no existen
    const maxTotalKey = `${planType}MaxTotal`;
    const maxThemesKey = `${planType}Max`;
    const maxOpeningsKey = `${planType}MaxOpenings`;

    if (!elos[maxTotalKey]) {
      const currentTotal = this.profile?.elos && (this.profile.elos as Record<string, any>)[`${planType}Total`]
        ? ((this.profile.elos as Record<string, any>)[`${planType}Total`] as number)
        : 1500;
      elos[maxTotalKey] = currentTotal;
    }
    if (!elos[maxThemesKey]) {
      elos[maxThemesKey] = {};
    }
    if (!elos[maxOpeningsKey]) {
      elos[maxOpeningsKey] = {};
    }

    themes.forEach(theme => {
      if (!elos[planType]) {
        elos[planType] = {}; // Crea planType si no existe
      }
      const currentThemeElo = (elos[planType] && elos[planType][theme]) || 1500;
      const newThemeElo = this.eloCalculator.calculateElo(currentThemeElo, puzzleElo, result).newElo;
      elos[planType][theme] = newThemeElo;

      // Verificar si es nuevo récord para este tema
      const currentMaxTheme = elos[maxThemesKey][theme];
      if (currentMaxTheme === undefined || newThemeElo > currentMaxTheme) {
        elos[maxThemesKey][theme] = newThemeElo;
        recordInfo.isNewThemeRecord = true;
        recordInfo.newThemeRecords.push(theme);
      }
    });

    // Calcular el elo total del plan, con el parámetro del perfil
    const totalKey = `${planType}Total`;
    const currentTotalElo = this.profile?.elos && (this.profile.elos as Record<string, any>)[totalKey]
      ? ((this.profile.elos as Record<string, any>)[totalKey] as number)
      : 1500;
    const newTotalElo = this.eloCalculator.calculateElo(currentTotalElo, puzzleElo, result).newElo;

    // Verificar si es nuevo récord total
    if (newTotalElo > elos[maxTotalKey]) {
      elos[maxTotalKey] = newTotalElo;
      recordInfo.isNewTotalRecord = true;
    }

    // Inicializa el objeto de cambios con una copia de los elos existentes para evitar la sobrescritura
    // Usamos Record para permitir acceso dinámico a propiedades
    const changes: { elos: Record<string, any> } = { elos: { ...elos } };

    // Actualiza específicamente para el tipo de plan y aperturas, haciendo merge adecuado
    changes.elos[planType] = { ...(changes.elos[planType] || {}), ...elos[planType] };

    // Actualiza el total del plan con el nuevo valor en el parámetro correspondiente al plan
    changes.elos[`${planType}Total`] = newTotalElo;

    // Actualizar máximos
    changes.elos[maxTotalKey] = elos[maxTotalKey];
    changes.elos[maxThemesKey] = { ...(changes.elos[maxThemesKey] || {}), ...elos[maxThemesKey] };

    if (openingFamily) {
      const openingsKey = `${planType}Openings`;
      changes.elos[openingsKey] = {
        ...(changes.elos[openingsKey] || {}),
        [openingFamily]: eloOpening
      };

      // Verificar si es nuevo récord para esta apertura
      const currentMaxOpening = elos[maxOpeningsKey][openingFamily];
      if (currentMaxOpening === undefined || eloOpening > currentMaxOpening) {
        elos[maxOpeningsKey][openingFamily] = eloOpening;
        recordInfo.isNewOpeningRecord = true;
        recordInfo.newOpeningRecord = openingFamily;
      }
      changes.elos[maxOpeningsKey] = { ...(changes.elos[maxOpeningsKey] || {}), ...elos[maxOpeningsKey] };
    }

    // Se actualiza el perfil con los cambios
    this.requestUpdateProfile(changes);

    return recordInfo;
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
    await this.setProfile(profileForSet);
  }
}
