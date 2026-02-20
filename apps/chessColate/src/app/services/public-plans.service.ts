import { inject, Injectable } from '@angular/core';
import { Plan, PublicPlan, PlanInteraction } from '@cpark/models';
import { FirestoreService } from './firestore.service';
import { PlanService } from './plan.service';

@Injectable({
  providedIn: 'root'
})
export class PublicPlansService {
  private firestoreService = inject(FirestoreService);
  private planService = inject(PlanService);

  /**
   * Enriquece planes públicos con interacciones del usuario actual
   */
  enrichPlansWithInteractions(
    plans: PublicPlan[],
    interactions: PlanInteraction[]
  ): PublicPlan[] {
    const interactionsMap = new Map<string, PlanInteraction>();
    interactions.forEach((interaction) => {
      interactionsMap.set(interaction.planUid, interaction);
    });

    return plans.map((plan) => ({
      ...plan,
      userInteraction: interactionsMap.get(plan.uid),
    }));
  }

  /**
   * Convierte PublicPlan a Plan para jugar
   * Prepara el plan para jugar usando PlanService.makeCustomPlanForPlay
   */
  async preparePlanForPlay(
    publicPlan: PublicPlan,
    eloToStart = 1500,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<Plan> {
    // Convertir PublicPlan a Plan (eliminar campos adicionales)
    const plan: Plan = {
      uid: publicPlan.uid,
      title: publicPlan.title,
      uidUser: publicPlan.uidUser,
      eloTotal: publicPlan.eloTotal,
      blocks: publicPlan.blocks,
      createdAt: publicPlan.createdAt,
      planType: publicPlan.planType,
      isFinished: publicPlan.isFinished,
      uidCustomPlan: publicPlan.uidCustomPlan,
      isPublic: publicPlan.isPublic,
    };

    // Si es un plan custom, usar makeCustomPlanForPlay
    if (plan.planType === 'custom' && plan.uidCustomPlan) {
      return await this.planService.makeCustomPlanForPlay(
        plan,
        eloToStart,
        onProgress
      );
    }

    // Para otros tipos de planes, retornar el plan tal cual
    // (aunque esto no debería pasar con planes públicos, que son custom)
    return plan;
  }

  /**
   * Obtiene la interacción del usuario para un plan específico
   */
  getUserInteractionForPlan(
    planUid: string,
    interactions: PlanInteraction[]
  ): PlanInteraction | undefined {
    return interactions.find((i) => i.planUid === planUid);
  }
}
