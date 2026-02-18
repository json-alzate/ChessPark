import { inject, Injectable } from '@angular/core';
import { Plan } from '@cpark/models';
import { FirestoreService } from '@services/firestore.service';
import { ProfileService } from '@services/profile.service';

@Injectable({
  providedIn: 'root',
})
export class CustomPlansService {
  private firestoreService = inject(FirestoreService);
  private profileService = inject(ProfileService);

  /**
   * Obtiene un plan personalizado por uid.
   */
  async getById(uid: string): Promise<Plan | null> {
    return this.firestoreService.getCustomPlan(uid);
  }

  /**
   * Obtiene los planes personalizados del usuario actual.
   */
  async getMyPlans(): Promise<Plan[]> {
    const uidUser = this.profileService.getProfile?.uid;
    if (!uidUser) {
      return [];
    }
    return this.firestoreService.getCustomPlans(uidUser);
  }

  /**
   * Guarda un nuevo plan personalizado en Firestore.
   */
  async save(plan: Plan): Promise<void> {
    await this.firestoreService.saveCustomPlan(plan);
  }

  /**
   * Actualiza un plan personalizado existente en Firestore.
   */
  async update(plan: Plan): Promise<void> {
    return this.firestoreService.updateCustomPlan(plan);
  }
}
