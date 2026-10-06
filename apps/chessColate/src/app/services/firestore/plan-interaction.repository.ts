import { Injectable, inject } from '@angular/core';

/** Firebase Modules **/
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection, query, where, getDocs,
} from 'firebase/firestore';

import { PlanInteraction } from '@cpark/models';
import { FirestoreConnection } from './firestore-connection.service';
import { PublicPlanRepository } from './public-plan.repository';
import { serializeFirestoreData } from './firestore-serialize.util';

/**
 * Repositorio del agregado Interacción usuario-plan (colección
 * `plan-interactions`): si un usuario dio like, guardó o jugó un plan público.
 * El id del documento es `${uidUser}_${planUid}`, uno por par usuario-plan.
 *
 * Métodos: getUserPlanInteractions, getUserPlanInteractionsByType,
 * getPlanInteraction, togglePlanLike, markPlanAsPlayed, togglePlanSaved.
 *
 * Las operaciones de escritura también actualizan los contadores del plan
 * público (likesCount, savedCount, timesPlayed), por eso dependen de
 * PublicPlanRepository. Son escrituras separadas, no una transacción: si la
 * segunda falla, la interacción queda guardada sin contador. Pasarlo a
 * transacción cambiaría el comportamiento, así que queda como deuda aparte.
 *
 * Consumido por: el puerto `libs/state` (PUBLIC_PLANS_FIRESTORE_TOKEN) a través
 * de PublicPlansFirestoreAdapter. Los componentes no lo usan: leen y escriben
 * interacciones por el store (PublicPlansFacadeService).
 */
@Injectable({
  providedIn: 'root'
})
export class PlanInteractionRepository {

  private connection = inject(FirestoreConnection);
  private publicPlans = inject(PublicPlanRepository);

  /**
   * Obtiene todas las interacciones del usuario
   */
  async getUserPlanInteractions(uidUser: string): Promise<PlanInteraction[]> {
    const interactionsToReturn: PlanInteraction[] = [];
    const q = query(
      collection(this.connection.db, 'plan-interactions'),
      where('uidUser', '==', uidUser)
    );
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach((document) => {
      const dataRaw = document.data();
      const interactionToAdd = serializeFirestoreData<PlanInteraction>(dataRaw);
      interactionToAdd.uid = document.id;
      interactionsToReturn.push(interactionToAdd);
    });

    return interactionsToReturn;
  }

  /**
   * Obtiene interacciones por tipo
   */
  async getUserPlanInteractionsByType(
    uidUser: string,
    type: 'liked' | 'played' | 'saved'
  ): Promise<PlanInteraction[]> {
    const interactionsToReturn: PlanInteraction[] = [];
    const q = query(
      collection(this.connection.db, 'plan-interactions'),
      where('uidUser', '==', uidUser),
      where(type, '==', true)
    );
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach((document) => {
      const dataRaw = document.data();
      const interactionToAdd = serializeFirestoreData<PlanInteraction>(dataRaw);
      interactionToAdd.uid = document.id;
      interactionsToReturn.push(interactionToAdd);
    });

    return interactionsToReturn;
  }

  /**
   * Obtiene una interacción específica
   */
  async getPlanInteraction(uidUser: string, planUid: string): Promise<PlanInteraction | null> {
    const interactionId = `${uidUser}_${planUid}`;
    const ref = doc(this.connection.db, 'plan-interactions', interactionId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const dataRaw = snap.data();
    const data = serializeFirestoreData<PlanInteraction>(dataRaw);
    data.uid = snap.id;
    return data;
  }

  /**
   * Toggle me gusta y actualiza estadísticas
   * Validar que uidUser !== plan.uidUser (el creador no puede dar me gusta)
   */
  async togglePlanLike(uidUser: string, planUid: string, liked: boolean): Promise<void> {
    // Obtener el plan para validar que el usuario no sea el creador
    const publicPlan = await this.publicPlans.getPublicPlan(planUid);
    if (!publicPlan) {
      throw new Error('Plan público no encontrado');
    }
    if (publicPlan.uidUser === uidUser) {
      throw new Error('El creador del plan no puede dar me gusta a su propio plan');
    }

    const interactionId = `${uidUser}_${planUid}`;
    const interactionRef = doc(this.connection.db, 'plan-interactions', interactionId);
    const interactionSnap = await getDoc(interactionRef);

    if (interactionSnap.exists()) {
      // Actualizar interacción existente
      await updateDoc(interactionRef, {
        liked,
        likedAt: liked ? Date.now() : null
      });
    } else {
      // Crear nueva interacción
      const newInteraction: PlanInteraction = {
        uid: interactionId,
        uidUser,
        planUid,
        liked,
        played: false,
        saved: false,
        likedAt: liked ? Date.now() : undefined
      };
      await setDoc(interactionRef, newInteraction);
    }

    // Actualizar estadísticas del plan
    if (liked) {
      await this.publicPlans.incrementPlanStats(planUid, 'likesCount');
    } else {
      await this.publicPlans.decrementPlanStats(planUid, 'likesCount');
    }
  }

  /**
   * Marca plan como jugado y actualiza estadísticas
   * El contador timesPlayed solo sube la primera vez que el usuario juega el plan.
   */
  async markPlanAsPlayed(uidUser: string, planUid: string): Promise<void> {
    const interactionId = `${uidUser}_${planUid}`;
    const interactionRef = doc(this.connection.db, 'plan-interactions', interactionId);
    const interactionSnap = await getDoc(interactionRef);

    const publicPlanRef = doc(this.connection.db, 'public-plans', planUid);

    const wasPlayed = interactionSnap.exists() && (interactionSnap.data() as PlanInteraction).played;

    if (interactionSnap.exists()) {
      // Actualizar interacción existente
      await updateDoc(interactionRef, {
        played: true,
        playedAt: Date.now()
      });
    } else {
      // Crear nueva interacción
      const newInteraction: PlanInteraction = {
        uid: interactionId,
        uidUser,
        planUid,
        liked: false,
        played: true,
        saved: false,
        playedAt: Date.now()
      };
      await setDoc(interactionRef, newInteraction);
    }

    // Actualizar estadísticas del plan solo si no estaba jugado antes
    if (!wasPlayed) {
      await this.publicPlans.incrementPlanStats(planUid, 'timesPlayed');
      await updateDoc(publicPlanRef, {
        lastPlayedAt: Date.now()
      });
    }
  }

  /**
   * Toggle guardado y actualiza estadísticas
   */
  async togglePlanSaved(uidUser: string, planUid: string, saved: boolean): Promise<void> {
    const interactionId = `${uidUser}_${planUid}`;
    const interactionRef = doc(this.connection.db, 'plan-interactions', interactionId);
    const interactionSnap = await getDoc(interactionRef);

    if (interactionSnap.exists()) {
      // Actualizar interacción existente
      await updateDoc(interactionRef, {
        saved,
        savedAt: saved ? Date.now() : null
      });
    } else {
      // Crear nueva interacción
      const newInteraction: PlanInteraction = {
        uid: interactionId,
        uidUser,
        planUid,
        liked: false,
        played: false,
        saved,
        savedAt: saved ? Date.now() : undefined
      };
      await setDoc(interactionRef, newInteraction);
    }

    // Actualizar estadísticas del plan
    if (saved) {
      await this.publicPlans.incrementPlanStats(planUid, 'savedCount');
    } else {
      await this.publicPlans.decrementPlanStats(planUid, 'savedCount');
    }
  }

}
