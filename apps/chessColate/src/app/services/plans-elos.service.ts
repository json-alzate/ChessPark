import { Injectable, inject } from '@angular/core';
import { PlanElos } from '@cpark/models';
import { FirestoreService } from '@services/firestore.service';
import { ProfileService } from '@services/profile.service';

@Injectable({
  providedIn: 'root'
})
export class PlansElosService {
  private firestoreService = inject(FirestoreService);
  private profileService = inject(ProfileService);

  constructor() {}

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

