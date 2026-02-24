import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PlanElos } from '@cpark/models';
import { EloCalculatorService, UidGeneratorService } from '@chesspark/common-utils';
import { PlansElosFacadeService } from '@cpark/state';
import { FirestoreService } from '@services/firestore.service';
import { ProfileService } from '@services/profile.service';

/**
 * Información sobre récords alcanzados en un plan
 */
export interface PlanRecordInfo {
  isNewTotalRecord: boolean;
  isNewThemeRecord: boolean;
  isNewOpeningRecord: boolean;
  newThemeRecords: string[];
  newOpeningRecord?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PlansElosService {
  private firestoreService = inject(FirestoreService);
  private profileService = inject(ProfileService);
  private plansElosFacade = inject(PlansElosFacadeService);
  private eloCalculator = inject(EloCalculatorService);
  private uidGenerator = inject(UidGeneratorService);

  constructor() {}

  /**
   * Calcula los elos de un plan custom tras un puzzle y actualiza estado (y vía effects, Firestore).
   * La lógica de dominio vive aquí; la fachada solo expone dispatch y selectores.
   * Retorna información sobre si se alcanzaron nuevos récords.
   */
  async calculatePlanElos(
    puzzleElo: number,
    result: 1 | 0.5 | 0,
    planUid: string,
    uidUser: string,
    themes: string[],
    openingFamily: string,
  ): Promise<PlanRecordInfo> {
    let planElos: PlanElos | null = await firstValueFrom(
      this.plansElosFacade.getPlanElo$(planUid)
    );

    if (!planElos) {
      planElos = {
        uid: '',
        uidUser,
        uidPlan: planUid,
        openings: {},
        themes: {},
        total: 1500,
        maxTotal: undefined,
        maxThemes: {},
        maxOpenings: {}
      };
    } else {
      planElos = {
        ...planElos,
        openings: { ...planElos.openings },
        themes: { ...planElos.themes },
        maxThemes: { ...(planElos.maxThemes || {}) },
        maxOpenings: { ...(planElos.maxOpenings || {}) }
      };
    }

    // Inicializar máximos si no existen
    if (planElos.maxTotal === undefined) {
      planElos.maxTotal = planElos.total || 1500;
    }
    if (!planElos.maxThemes) {
      planElos.maxThemes = {};
    }
    if (!planElos.maxOpenings) {
      planElos.maxOpenings = {};
    }

    let eloOpening = 1500;
    if (openingFamily && planElos.openings) {
      const currentElo = planElos.openings[openingFamily] || 1500;
      eloOpening = this.eloCalculator.calculateElo(currentElo, puzzleElo, result).newElo;
    } else {
      eloOpening = this.eloCalculator.calculateElo(1500, puzzleElo, result).newElo;
    }

    const temThemes = planElos.themes ? { ...planElos.themes } : {};
    const recordInfo: PlanRecordInfo = {
      isNewTotalRecord: false,
      isNewThemeRecord: false,
      isNewOpeningRecord: false,
      newThemeRecords: [],
      newOpeningRecord: undefined
    };

    themes.forEach(theme => {
      const currentThemeElo = temThemes[theme] || 1500;
      const newThemeElo = this.eloCalculator.calculateElo(currentThemeElo, puzzleElo, result).newElo;
      temThemes[theme] = newThemeElo;

      // Verificar si es nuevo récord para este tema
      const currentMaxTheme = planElos.maxThemes![theme];
      if (currentMaxTheme === undefined || newThemeElo > currentMaxTheme) {
        planElos.maxThemes![theme] = newThemeElo;
        recordInfo.isNewThemeRecord = true;
        recordInfo.newThemeRecords.push(theme);
      }
    });
    planElos.themes = temThemes;

    const currentTotalElo = planElos.total || 1500;
    const newTotalElo = this.eloCalculator.calculateElo(currentTotalElo, puzzleElo, result).newElo;
    planElos.total = newTotalElo;

    // Verificar si es nuevo récord total
    if (newTotalElo > planElos.maxTotal!) {
      planElos.maxTotal = newTotalElo;
      recordInfo.isNewTotalRecord = true;
    }

    if (openingFamily) {
      planElos.openings = {
        ...(planElos.openings || {}),
        [openingFamily]: eloOpening
      };

      // Verificar si es nuevo récord para esta apertura
      const currentMaxOpening = planElos.maxOpenings![openingFamily];
      if (currentMaxOpening === undefined || eloOpening > currentMaxOpening) {
        planElos.maxOpenings![openingFamily] = eloOpening;
        recordInfo.isNewOpeningRecord = true;
        recordInfo.newOpeningRecord = openingFamily;
      }
    }

    if (planElos.uid) {
      this.plansElosFacade.requestUpdatePlanElos(planElos);
    } else {
      planElos.uid = this.uidGenerator.generateSimpleUid();
      planElos.uidUser = uidUser;
      planElos.uidPlan = planUid;
      this.plansElosFacade.requestAddOnePlanElo(planElos);
    }

    return recordInfo;
  }

  getWeakness(planElos: { [key: string]: number }): string | null {
    if (!planElos || Object.keys(planElos).length === 0) {
      return null;
    }
    
    const entries = Object.entries(planElos);
    const weakest = entries.reduce((min, current) => 
      current[1] < min[1] ? current : min
    );
    
    return weakest[0];
  }

  getStrongestTheme(planElos: { [key: string]: number }): string | null {
    if (!planElos || Object.keys(planElos).length === 0) {
      return null;
    }
    
    const entries = Object.entries(planElos);
    const strongest = entries.reduce((max, current) => 
      current[1] > max[1] ? current : max
    );
    
    return strongest[0];
  }

  async getOnePlanElo(planUid: string): Promise<PlanElos> {
    const profile = this.profileService.getProfile;
    if (!profile?.uid) {
      return {} as unknown as PlanElos;
    }
    return await this.firestoreService.getPlanElos(planUid, profile.uid);
  }

  /**
   * Incrementa el contador de veces jugado de un plan custom.
   * Se llama cuando el usuario finaliza un plan.
   */
  async incrementPlayCount(planUid: string, uidUser: string): Promise<void> {
    let planElos: PlanElos | null = await firstValueFrom(
      this.plansElosFacade.getPlanElo$(planUid)
    );
    if (!planElos || !planElos.uid) {
      planElos = await this.firestoreService.getPlanElos(planUid, uidUser);
    }

    if (planElos && planElos.uid) {
      const updated = {
        ...planElos,
        timesPlayed: (planElos.timesPlayed ?? 0) + 1,
      };
      this.plansElosFacade.requestUpdatePlanElos(updated);
    } else {
      const newPlanElos: PlanElos = {
        uid: this.uidGenerator.generateSimpleUid(),
        uidUser,
        uidPlan: planUid,
        openings: {},
        themes: {},
        total: 1500,
        timesPlayed: 1,
      };
      this.plansElosFacade.requestAddOnePlanElo(newPlanElos);
    }
  }
}

