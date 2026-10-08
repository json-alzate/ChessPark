import { Injectable, inject } from '@angular/core';

/** Firebase Modules **/
import {
  doc,
  setDoc,
  updateDoc,
  collection, query, where, getDocs,
} from 'firebase/firestore';

import { PlanElos } from '@chesspark/models';
import { FirestoreConnection } from './firestore-connection.service';

/**
 * Repositorio del agregado ELO por plan (colección `plansElos`): el ELO que
 * el usuario tiene en cada tipo/plan de entrenamiento.
 *
 * Métodos: getPlansElos (todos del usuario), getPlanElos (uno por plan y
 * usuario), savePlanElo (upsert por uid), updatePlanElo.
 *
 * Consumido por: PlansElosService y, como puerto de `libs/state`
 * (FIRESTORE_SERVICE_TOKEN), por el efecto de plansElos en el store.
 */
@Injectable({
  providedIn: 'root'
})
export class PlanElosRepository {

  private connection = inject(FirestoreConnection);

  /**
   * Get plasElos from firestore
   *
   * @param uidUser
   * @returns PlanElos[]
   * */
  async getPlansElos(uidUser: string): Promise<PlanElos[]> {
    const plansToReturn: PlanElos[] = [];
    const q = query(
      collection(this.connection.db, 'plansElos'),
      where('uidUser', '==', uidUser)
    );
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach((document) => {
      const planToAdd = document.data() as PlanElos;
      planToAdd.uid = document.id;
      plansToReturn.push(planToAdd);
    });
    console.log('getPlansElos plansToReturn', plansToReturn);

    return plansToReturn;
  }


  /**
   * Get planElos from firestore
   *
   * @param uidPlan
   * @param uidUser
   * @returns
   * */
  async getPlanElos(uidPlan: string, uidUser: string): Promise<PlanElos> {

    const q = query(
      collection(this.connection.db, 'plansElos'),
      where('uidPlan', '==', uidPlan),
      where('uidUser', '==', uidUser)
    );

    const querySnapshot = await getDocs(q);
    if (querySnapshot.size > 0) {
      const planElo = querySnapshot.docs[0].data() as PlanElos;
      return planElo;
    }
    return {} as unknown as PlanElos;
  }

  /**
   * Save a planElo in firestore
   *
   * @param planElo
   * @returns
   * */
  async savePlanElo(planElo: PlanElos): Promise<string | void> {
    return setDoc(doc(this.connection.db, 'plansElos', planElo.uid), planElo);
  }

  /**
   * Update a planElo in firestore
   *
   * @param planElo
   * @returns
   * */
  async updatePlanElo(planElo: PlanElos) {
    return updateDoc(doc(this.connection.db, 'plansElos', planElo.uid), { ...planElo });
  }

}
