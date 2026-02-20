import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { Plan } from '@cpark/models';

import { FirestoreService } from '@services/firestore.service';
import { CustomPlansFacadeService } from '@cpark/state';

@Injectable({
  providedIn: 'root',
})
export class CustomPlansService {
  private firestoreService = inject(FirestoreService);
  private customPlansFacade = inject(CustomPlansFacadeService);

  /**
   * Obtiene un plan personalizado por uid.
   * Usa el estado si está disponible, sino consulta Firestore.
   */
  async getById(uid: string): Promise<Plan | null> {
    const fromState = await firstValueFrom(
      this.customPlansFacade.getCustomPlan$(uid)
    );
    if (fromState) return fromState;
    return this.firestoreService.getCustomPlan(uid);
  }

  /**
   * Observable de los planes personalizados del usuario (desde el estado NgRx).
   */
  getMyPlans$() {
    return this.customPlansFacade.getCustomPlansOrderByDate$();
  }

  /**
   * Guarda un nuevo plan personalizado en Firestore y actualiza el estado.
   * Sincroniza con public-plans si el plan es público.
   * TODO: no llamar directamente a firestore, pasar por el facade o store.
   */
  async save(plan: Plan): Promise<void> {
    await this.firestoreService.saveCustomPlan(plan);
    this.customPlansFacade.addOneCustomPlan(plan);
    // Sincronizar con public-plans si es público
    await this.firestoreService.syncPlanToPublic(plan);
  }

  /**
   * Actualiza un plan personalizado existente en Firestore y actualiza el estado.
   * Sincroniza con public-plans si el plan es público.
   */
  async update(plan: Plan): Promise<void> {
    await this.firestoreService.updateCustomPlan(plan);
    this.customPlansFacade.updateCustomPlanInState(plan);
    // Sincronizar con public-plans (maneja isPublic true/false)
    await this.firestoreService.syncPlanToPublic(plan);
  }
}
