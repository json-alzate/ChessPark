import { Injectable, inject } from '@angular/core';

/** Firebase Modules **/
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection, query, where, getDocs,
} from 'firebase/firestore';

import { Plan } from '@cpark/models';
import { FirestoreConnection } from './firestore-connection.service';

/**
 * Repositorio del agregado Plan personalizado (colección `custom-plans`).
 * Es la fuente de verdad del plan del usuario; su copia pública
 * (`public-plans`) la mantiene PublicPlanRepository.syncPlanToPublic.
 *
 * Métodos: saveCustomPlan (upsert), getCustomPlans (de un usuario),
 * getCustomPlan (por uid), updateCustomPlan.
 *
 * Consumido por: CustomPlansService y, como puerto de `libs/state`
 * (CUSTOM_PLANS_FIRESTORE_TOKEN), por el efecto de custom plans en el store.
 */
@Injectable({
  providedIn: 'root'
})
export class CustomPlanRepository {

  private connection = inject(FirestoreConnection);

  /**
   * Guarda un plan personalizado nuevo o sobrescribe el existente.
   *
   * @param plan
   * @returns
   * */
  async saveCustomPlan(plan: Plan): Promise<string | void> {
    return setDoc(doc(this.connection.db, 'custom-plans', plan.uid), plan);
  }


  /**
   * Obtiene los planes personalizados de un usuario.
   *
   * @param uidUser
   * @returns CustomPlan[]
   * */
  async getCustomPlans(uidUser: string): Promise<Plan[]> {
    const plansToReturn: Plan[] = [];
    const q = query(
      collection(this.connection.db, 'custom-plans'),
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
   * Get a single custom plan by uid.
   */
  async getCustomPlan(uid: string): Promise<Plan | null> {
    const ref = doc(this.connection.db, 'custom-plans', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data() as Plan;
    data.uid = snap.id;
    return data;
  }


  /**
   * Update a custom plan in firestore
   *
   * @param changes Plan
   * @returns
   * */
  async updateCustomPlan(customPlan: Plan): Promise<void> {
    return updateDoc(doc(this.connection.db, 'custom-plans', customPlan.uid), { ...customPlan });
  }

}
