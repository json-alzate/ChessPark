import { Injectable, inject } from '@angular/core';

import { PublicPlan, PlanInteraction, PublicPlanFilter } from '@chesspark/models';
import { IPublicPlansFirestore } from '@chesspark/state';

import { PublicPlanRepository } from './public-plan.repository';
import { PlanInteractionRepository } from './plan-interaction.repository';

/**
 * Adaptador que implementa el puerto `IPublicPlansFirestore` de `libs/state`
 * (PUBLIC_PLANS_FIRESTORE_TOKEN) combinando dos repositorios.
 *
 * El efecto de public-plans necesita planes públicos e interacciones en una
 * sola interfaz. Este adaptador solo delega, sin lógica propia. Si el puerto
 * se divide en dos (uno por agregado), este archivo se puede borrar.
 *
 * Consumido por: main.ts, como proveedor de PUBLIC_PLANS_FIRESTORE_TOKEN.
 */
@Injectable({
  providedIn: 'root'
})
export class PublicPlansFirestoreAdapter implements IPublicPlansFirestore {

  private publicPlans = inject(PublicPlanRepository);
  private interactions = inject(PlanInteractionRepository);

  getPublicPlans(
    filter: PublicPlanFilter,
    limitCount: number,
    lastPlanUid?: string | null
  ): Promise<{ plans: PublicPlan[]; lastPlanUid: string | null }> {
    return this.publicPlans.getPublicPlans(filter, limitCount, lastPlanUid);
  }

  getPublicPlan(planUid: string): Promise<PublicPlan | null> {
    return this.publicPlans.getPublicPlan(planUid);
  }

  getUserPlanInteractions(uidUser: string): Promise<PlanInteraction[]> {
    return this.interactions.getUserPlanInteractions(uidUser);
  }

  getPlanInteraction(uidUser: string, planUid: string): Promise<PlanInteraction | null> {
    return this.interactions.getPlanInteraction(uidUser, planUid);
  }

  togglePlanLike(uidUser: string, planUid: string, liked: boolean): Promise<void> {
    return this.interactions.togglePlanLike(uidUser, planUid, liked);
  }

  markPlanAsPlayed(uidUser: string, planUid: string): Promise<void> {
    return this.interactions.markPlanAsPlayed(uidUser, planUid);
  }

  togglePlanSaved(uidUser: string, planUid: string, saved: boolean): Promise<void> {
    return this.interactions.togglePlanSaved(uidUser, planUid, saved);
  }
}
