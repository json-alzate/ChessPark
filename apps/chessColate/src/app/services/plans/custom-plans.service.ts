import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { Plan } from '@chesspark/models';

import { CustomPlanRepository } from '@services/firestore/custom-plan.repository';
import { PublicPlanRepository } from '@services/firestore/public-plan.repository';
import { AnalyticsService } from '@services/analytics/analytics.service';
import { CustomPlansFacadeService } from '@chesspark/state';

/**
 * Orquesta las escrituras de planes personalizados: guarda en Firestore,
 * actualiza el store y sincroniza la copia pública cuando corresponde.
 *
 * Las lecturas salen del store (CustomPlansFacadeService); solo `getById`
 * cae a Firestore si el plan no está en memoria. Las escrituras se hacen con
 * await para que un error llegue al formulario que guarda, en vez de perderse
 * en un efecto del store.
 *
 * Consumido por: CustomPlanFormComponent (getById, save, update) y
 * CustomPlansListComponent (getMyPlans$).
 */
@Injectable({
  providedIn: 'root',
})
export class CustomPlansService {
  private customPlanRepository = inject(CustomPlanRepository);
  private publicPlanRepository = inject(PublicPlanRepository);
  private customPlansFacade = inject(CustomPlansFacadeService);
  private analyticsService = inject(AnalyticsService);

  /**
   * Obtiene un plan personalizado por uid.
   * Usa el estado si está disponible, sino consulta Firestore.
   */
  async getById(uid: string): Promise<Plan | null> {
    const fromState = await firstValueFrom(
      this.customPlansFacade.getCustomPlan$(uid)
    );
    if (fromState) return fromState;
    return this.customPlanRepository.getCustomPlan(uid);
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
   *
   * La escritura va primero a Firestore y solo después al store: así el estado
   * nunca tiene un plan que no existe en la base si la escritura falla.
   */
  async save(plan: Plan): Promise<void> {
    await this.customPlanRepository.saveCustomPlan(plan);
    this.customPlansFacade.addOneCustomPlan(plan);
    // Sincronizar con public-plans si es público
    await this.publicPlanRepository.syncPlanToPublic(plan);
    void this.analyticsService.logEvent('custom_plan_created', {
      plan_uid: plan.uid,
      is_public: !!plan.isPublic,
      blocks_count: plan.blocks?.length ?? 0,
    });
  }

  /**
   * Actualiza un plan personalizado existente en Firestore y actualiza el estado.
   * Sincroniza con public-plans si el plan es público.
   */
  async update(plan: Plan): Promise<void> {
    await this.customPlanRepository.updateCustomPlan(plan);
    this.customPlansFacade.updateCustomPlanInState(plan);
    // Sincronizar con public-plans (maneja isPublic true/false)
    await this.publicPlanRepository.syncPlanToPublic(plan);
    void this.analyticsService.logEvent('custom_plan_updated', {
      plan_uid: plan.uid,
      is_public: !!plan.isPublic,
    });
  }
}
