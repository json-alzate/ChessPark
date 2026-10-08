import { Injectable, inject } from '@angular/core';

/** Firebase Modules **/
import {
  doc,
  setDoc,
  collection, query, where, getDocs,
} from 'firebase/firestore';

import { Plan } from '@chesspark/models';
import { FirestoreConnection } from './firestore-connection.service';

/**
 * Repositorio del agregado Plan de rutina (colección `plans`).
 *
 * Métodos: getPlans (planes de un usuario), savePlan (upsert por uid).
 * Los planes personalizados viven en CustomPlanRepository, no aquí.
 *
 * Consumido por: PlanService.
 */
@Injectable({
  providedIn: 'root'
})
export class PlanRepository {

  private connection = inject(FirestoreConnection);

  /**
   * Get plans from firestore
   * Obtiene los planes de firestore
   *
   * @param uidUser
   * @returns
   * */
  async getPlans(uidUser: string): Promise<Plan[]> {
    const plansToReturn: Plan[] = [];
    const q = query(
      collection(this.connection.db, 'plans'),
      where('uidUser', '==', uidUser)
    );
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach((document) => {
      const planToAdd = document.data() as Plan;
      planToAdd.uid = document.id;
      plansToReturn.push(planToAdd);
    });

    return plansToReturn;
  }


  /**
   * Save a plan in firestore
   * Guarda un plan en firestore
   *
   * @param plan
   * @returns
   * */
  async savePlan(plan: Plan): Promise<string | void> {
    return setDoc(doc(this.connection.db, 'plans', plan.uid), plan);
  }

}
