import { Injectable, inject } from '@angular/core';

/** Firebase Modules **/
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection, query, where, getDocs,
  orderBy,
  limit,
  startAfter,
  increment,
} from 'firebase/firestore';

import { Plan, PublicPlan, PublicPlanFilter } from '@chesspark/models';
import { FirestoreConnection } from './firestore-connection.service';
import { serializeFirestoreData } from './firestore-serialize.util';

/**
 * Repositorio del agregado Plan público (colección `public-plans`): la copia
 * visible para todos de un plan personalizado, con sus contadores
 * (timesPlayed, likesCount, savedCount).
 *
 * Métodos: syncPlanToPublic (duplica/actualiza desde un custom plan),
 * getPublicPlans (listado paginado y filtrado), getPublicPlan (uno por uid),
 * incrementPlanStats / decrementPlanStats (contadores).
 *
 * Las interacciones de usuario (like, guardado, jugado) viven en
 * PlanInteractionRepository, que usa este repositorio para tocar contadores.
 *
 * Consumido por: CustomPlansService (sincronización), PlanInteractionRepository,
 * y, como puerto de `libs/state` (PUBLIC_PLANS_FIRESTORE_TOKEN) a través de
 * PublicPlansFirestoreAdapter.
 */
@Injectable({
  providedIn: 'root'
})
export class PublicPlanRepository {

  private connection = inject(FirestoreConnection);

  /**
   * Sincroniza/duplica plan completo a public-plans
   * Si isPublic=true, marca como activo. Si isPublic=false, marca como inactivo (no elimina)
   */
  async syncPlanToPublic(plan: Plan): Promise<void> {
    const publicPlanRef = doc(this.connection.db, 'public-plans', plan.uid);
    const publicPlanSnap = await getDoc(publicPlanRef);

    // Función helper para limpiar bloques: eliminar puzzles y puzzlesPlayed que no deben estar en public-plans
    const cleanBlocks = (blocks: any[]): any[] => {
      return blocks.map(({ puzzles, puzzlesPlayed, ...rest }) => ({
        ...rest,
        puzzlesPlayed: [] // Siempre array vacío en public-plans
      }));
    };

    // Función helper para eliminar campos undefined y hacer el objeto serializable
    // Primero crear una copia profunda para evitar problemas con objetos congelados
    const removeUndefined = (obj: any): any => {
      // Crear una copia profunda primero para evitar problemas con objetos congelados
      let objCopy: any;
      try {
        objCopy = JSON.parse(JSON.stringify(obj));
      } catch (e) {
        // Si falla la serialización, crear un objeto limpio manualmente
        objCopy = {};
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            try {
              const value = obj[key];
              if (value !== undefined && typeof value !== 'function' && typeof value !== 'symbol') {
                if (Array.isArray(value)) {
                  objCopy[key] = value.map(item =>
                    typeof item === 'object' && item !== null
                      ? removeUndefined(item)
                      : item
                  );
                } else if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
                  objCopy[key] = removeUndefined(value);
                } else {
                  objCopy[key] = value;
                }
              }
            } catch (err) {
              // Omitir propiedades problemáticas
              continue;
            }
          }
        }
      }

      const cleaned: any = {};
      for (const [key, value] of Object.entries(objCopy)) {
        if (value !== undefined) {
          // Si es un array, limpiar cada elemento
          if (Array.isArray(value)) {
            cleaned[key] = value.map(item =>
              typeof item === 'object' && item !== null
                ? removeUndefined(item)
                : item
            );
          } else if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
            // Si es un objeto (pero no Date), limpiar recursivamente
            cleaned[key] = removeUndefined(value);
          } else {
            cleaned[key] = value;
          }
        }
      }
      return cleaned;
    };

    if (!publicPlanSnap.exists()) {
      // Crear nuevo: duplicar plan completo + estadísticas iniciales
      const publicPlan: any = {
        uid: plan.uid,
        title: plan.title,
        uidUser: plan.uidUser,
        eloTotal: plan.eloTotal,
        blocks: cleanBlocks(plan.blocks), // Limpiar bloques
        createdAt: plan.createdAt,
        planType: plan.planType,
        isFinished: plan.isFinished,
        uidCustomPlan: plan.uidCustomPlan,
        isPublic: plan.isPublic ?? false,
        timesPlayed: 0,
        likesCount: 0,
        savedCount: 0
      };
      // Eliminar campos undefined antes de guardar
      const cleanPlan = removeUndefined(publicPlan);
      await setDoc(publicPlanRef, cleanPlan);
    } else {
      // Actualizar existente: actualizar todos los campos del plan pero mantener estadísticas
      // Crear una copia del existingData para evitar problemas con objetos congelados
      const existingDataRaw = publicPlanSnap.data();
      const existingData: any = existingDataRaw ? JSON.parse(JSON.stringify(existingDataRaw)) : {};

      const updatedPlan: any = {
        uid: plan.uid,
        title: plan.title,
        uidUser: plan.uidUser,
        eloTotal: plan.eloTotal,
        blocks: cleanBlocks(plan.blocks), // Limpiar bloques
        createdAt: plan.createdAt,
        planType: plan.planType,
        isFinished: plan.isFinished,
        uidCustomPlan: plan.uidCustomPlan,
        isPublic: plan.isPublic ?? false,
        timesPlayed: existingData.timesPlayed ?? 0,
        likesCount: existingData.likesCount ?? 0,
        savedCount: existingData.savedCount ?? 0
      };
      // Solo agregar lastPlayedAt si existe
      if (existingData.lastPlayedAt !== undefined) {
        updatedPlan.lastPlayedAt = existingData.lastPlayedAt;
      }
      // Eliminar campos undefined antes de guardar
      const cleanPlan = removeUndefined(updatedPlan);
      await setDoc(publicPlanRef, cleanPlan);
    }
  }

  /**
   * Obtiene planes públicos con filtros e infinite scroll
   * IMPORTANTE: Filtrar por where('isPublic', '==', true) para solo mostrar activos
   */
  async getPublicPlans(
    filter: PublicPlanFilter,
    limitCount: number,
    lastPlanUid?: string | null
  ): Promise<{ plans: PublicPlan[]; lastPlanUid: string | null }> {
    const plansToReturn: PublicPlan[] = [];
    let q;

    // Construir query según el filtro
    const baseQuery = query(
      collection(this.connection.db, 'public-plans'),
      where('isPublic', '==', true) // Solo planes activos
    );

    switch (filter) {
      case 'recent':
        q = query(baseQuery, orderBy('createdAt', 'desc'), limit(limitCount));
        break;
      case 'mostPlayed':
        q = query(baseQuery, orderBy('timesPlayed', 'desc'), limit(limitCount));
        break;
      case 'mostLiked':
        q = query(baseQuery, orderBy('likesCount', 'desc'), limit(limitCount));
        break;
      default:
        q = query(baseQuery, orderBy('createdAt', 'desc'), limit(limitCount));
    }

    // Si hay lastPlanUid, obtener el documento y usar startAfter para paginación
    if (lastPlanUid) {
      const lastDocRef = doc(this.connection.db, 'public-plans', lastPlanUid);
      const lastDocSnap = await getDoc(lastDocRef);
      if (lastDocSnap.exists()) {
        q = query(q, startAfter(lastDocSnap));
      }
    }

    const querySnapshot = await getDocs(q);

    querySnapshot.forEach((document) => {
      const data = document.data();

      // Usar JSON para serializar completamente y eliminar cualquier referencia no serializable
      let serialized: any;
      try {
        serialized = JSON.parse(JSON.stringify(data));
      } catch (e) {
        console.error('Error serializing plan data:', e);
        // Si falla la serialización, crear un objeto limpio manualmente
        serialized = {
          uid: document.id,
          title: data['title'],
          uidUser: data['uidUser'],
          eloTotal: data['eloTotal'],
          createdAt: data['createdAt'],
          planType: data['planType'],
          isFinished: data['isFinished'],
          uidCustomPlan: data['uidCustomPlan'],
          isPublic: data['isPublic'] ?? false,
          timesPlayed: data['timesPlayed'] ?? 0,
          likesCount: data['likesCount'] ?? 0,
          savedCount: data['savedCount'] ?? 0,
          lastPlayedAt: data['lastPlayedAt'],
          blocks: []
        };
      }

      // Construir el plan de forma explícita para asegurar que sea completamente plano
      const planToAdd: PublicPlan = {
        uid: document.id,
        title: serialized['title'],
        uidUser: serialized['uidUser'],
        eloTotal: serialized['eloTotal'],
        createdAt: serialized['createdAt'],
        planType: serialized['planType'],
        isFinished: serialized['isFinished'],
        uidCustomPlan: serialized['uidCustomPlan'],
        isPublic: serialized['isPublic'] ?? false,
        timesPlayed: serialized['timesPlayed'] ?? 0,
        likesCount: serialized['likesCount'] ?? 0,
        savedCount: serialized['savedCount'] ?? 0,
        lastPlayedAt: serialized['lastPlayedAt'],
        // Limpiar bloques explícitamente
        blocks: ((serialized['blocks'] as any[]) || []).map((block: any) => {
          // Crear un objeto completamente nuevo y plano para cada bloque
          const cleanBlock: any = {
            title: block['title'],
            description: block['description'],
            time: block['time'],
            puzzlesCount: block['puzzlesCount'],
            theme: block['theme'],
            openingFamily: block['openingFamily'],
            elo: block['elo'],
            color: block['color'],
            puzzleTimes: block['puzzleTimes'] ? {
              warningOn: block['puzzleTimes']['warningOn'],
              dangerOn: block['puzzleTimes']['dangerOn'],
              total: block['puzzleTimes']['total']
            } : undefined,
            puzzlesPlayed: [], // Siempre array vacío
            showPuzzleSolution: block['showPuzzleSolution'],
            nextPuzzleImmediately: block['nextPuzzleImmediately'],
            goshPuzzle: block['goshPuzzle'],
            goshPuzzleTime: block['goshPuzzleTime']
          };
          // Eliminar propiedades undefined
          Object.keys(cleanBlock).forEach(key => {
            if (cleanBlock[key] === undefined) {
              delete cleanBlock[key];
            }
          });
          return cleanBlock;
        })
      };

      // Eliminar propiedades undefined del plan
      Object.keys(planToAdd).forEach(key => {
        if ((planToAdd as any)[key] === undefined) {
          delete (planToAdd as any)[key];
        }
      });

      plansToReturn.push(planToAdd);
    });

    const lastPlanUidResult = querySnapshot.docs.length > 0
      ? querySnapshot.docs[querySnapshot.docs.length - 1].id
      : null;

    return { plans: plansToReturn, lastPlanUid: lastPlanUidResult };
  }

  /**
   * Obtiene un plan público específico
   */
  async getPublicPlan(planUid: string): Promise<PublicPlan | null> {
    const ref = doc(this.connection.db, 'public-plans', planUid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const dataRaw = snap.data();
    const data = serializeFirestoreData<PublicPlan>(dataRaw);
    data.uid = snap.id;
    return data;
  }

  /**
   * Incrementa estadística del plan
   */
  async incrementPlanStats(
    planUid: string,
    field: 'timesPlayed' | 'likesCount' | 'savedCount'
  ): Promise<void> {
    const publicPlanRef = doc(this.connection.db, 'public-plans', planUid);
    await updateDoc(publicPlanRef, {
      [field]: increment(1)
    });
  }

  /**
   * Decrementa estadística del plan
   */
  async decrementPlanStats(
    planUid: string,
    field: 'likesCount' | 'savedCount'
  ): Promise<void> {
    const publicPlanRef = doc(this.connection.db, 'public-plans', planUid);
    const publicPlanSnap = await getDoc(publicPlanRef);
    if (publicPlanSnap.exists()) {
      const currentData = publicPlanSnap.data() as PublicPlan;
      const currentValue = currentData[field] ?? 0;
      const newValue = Math.max(0, currentValue - 1); // No permitir valores negativos
      await updateDoc(publicPlanRef, {
        [field]: newValue
      });
    }
  }

}
