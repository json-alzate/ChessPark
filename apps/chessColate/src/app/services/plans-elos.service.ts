import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PlanElos } from '@cpark/models';
import { EloCalculatorService, UidGeneratorService } from '@chesspark/common-utils';
import { PlansElosFacadeService } from '@cpark/state';
import { FirestoreService } from '@services/firestore.service';
import { ProfileService } from '@services/profile.service';

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
   */
  async calculatePlanElos(
    puzzleElo: number,
    result: 1 | 0.5 | 0,
    planUid: string,
    uidUser: string,
    themes: string[],
    openingFamily: string,
  ): Promise<void> {
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
        total: 1500
      };
    } else {
      planElos = {
        ...planElos,
        openings: { ...planElos.openings },
        themes: { ...planElos.themes }
      };
    }

    let eloOpening = 1500;
    if (openingFamily && planElos.openings) {
      const currentElo = planElos.openings[openingFamily] || 1500;
      eloOpening = this.eloCalculator.calculateElo(currentElo, puzzleElo, result).newElo;
    } else {
      eloOpening = this.eloCalculator.calculateElo(1500, puzzleElo, result).newElo;
    }

    const temThemes = planElos.themes ? { ...planElos.themes } : {};
    themes.forEach(theme => {
      const currentThemeElo = temThemes[theme] || 1500;
      temThemes[theme] = this.eloCalculator.calculateElo(currentThemeElo, puzzleElo, result).newElo;
    });
    planElos.themes = temThemes;

    const currentTotalElo = planElos.total || 1500;
    planElos.total = this.eloCalculator.calculateElo(currentTotalElo, puzzleElo, result).newElo;

    if (openingFamily) {
      planElos.openings = {
        ...(planElos.openings || {}),
        [openingFamily]: eloOpening
      };
    }

    if (planElos.uid) {
      this.plansElosFacade.requestUpdatePlanElos(planElos);
    } else {
      planElos.uid = this.uidGenerator.generateSimpleUid();
      planElos.uidUser = uidUser;
      planElos.uidPlan = planUid;
      this.plansElosFacade.requestAddOnePlanElo(planElos);
    }
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
}

