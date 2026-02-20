import { Injectable } from '@angular/core';

/** Capacitor Modules **/

/** Firebase Modules **/
import { getApp } from 'firebase/app';
import {
  Firestore,
  DocumentReference,
  DocumentData,
  FirestoreSettings,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  getFirestore,
  initializeFirestore,
  collection, query, where, getDocs,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentSnapshot,
  increment,
  deleteDoc,
} from 'firebase/firestore';


// Models
import { Profile } from '@cpark/models';
import { CoordinatesPuzzle } from '@cpark/models';
import { Puzzle } from '@cpark/models';
import { UserPuzzle } from '@cpark/models';
import { Plan, Block } from '@cpark/models';
import { PlanElos } from '@cpark/models';
import { PublicPlan, PlanInteraction, PublicPlanFilter } from '@cpark/models';

@Injectable({
  providedIn: 'root'
})
export class FirestoreService {

  private db!: Firestore;
  private profileDocRef!: DocumentReference<DocumentData>;



  constructor() { }

  async init() {
    const firestoreSettings: FirestoreSettings & { useFetchStreams: boolean } = {
      useFetchStreams: false
    };
    initializeFirestore(getApp(), firestoreSettings);
    this.db = getFirestore(getApp());
  }


  /**************************************************************/
  /* PROFILE                                                      */
  /**************************************************************/

  /**
   * Get a user from Firestore
   *
   * @param uid
   * @returns Promise<User>
   */
  async getProfile(uid: string): Promise<Profile> {

    this.profileDocRef = doc(this.db, 'Users', uid);
    const docSnap = await getDoc(this.profileDocRef);
    if (docSnap.exists()) {
      return docSnap.data() as Profile;
    } else {
      console.log(`No user found with uid ${uid}`);
      return null as unknown as Profile;
    }

  }


  /**
   * Crea un nuevo perfil
   *
   * @param profile
   * @returns Promise<void>
   */
  createProfile(profile: Profile) {
    return setDoc(doc(this.db, 'Users', profile.uid), profile);
  }

  /**
   * Update a User in firestore
   *
   * @param changes Partial<User>
   */
  async updateProfile(changes: Partial<Profile>): Promise<void> {
    // validate if profileDocRef exists
    if (!this.profileDocRef) {
      throw new Error('No profileDocRef');
    }
    return updateDoc(this.profileDocRef, changes);
  }


  async checkNickname(nickName: string): Promise<string[]> {
    const nicksToReturn: string[] = [];
    const q = query(
      collection(this.db, 'nickNames'),
      where('nickname', '==', nickName)
    );
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach((document) => {
      const nickToAdd = document.data();
      nicksToReturn.push(nickToAdd as unknown as string);
    });
    return nicksToReturn;

  }


  async addNewNickName(nickname: string, uidUser: string): Promise<string> {
    const docRef = await addDoc(collection(this.db, 'nickNames'), {
      nickname,
      uidUser
    });
    return docRef.id;
  }


  /**
   // ----------------------------------------------------------------------------
   Coordinates Puzzles
   */

  async getCoordinatesPuzzles(uidUser: string): Promise<CoordinatesPuzzle[]> {
    const coordinatesPuzzlesToReturn: CoordinatesPuzzle[] = [];
    const q = query(
      collection(this.db, 'coordinatesPuzzles'),
      where('uidUser', '==', uidUser)
    );
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach((document) => {
      const coordinaPuzzleToAdd = document.data() as CoordinatesPuzzle;
      coordinaPuzzleToAdd.uid = document.id;
      coordinatesPuzzlesToReturn.push(coordinaPuzzleToAdd);
    });

    return coordinatesPuzzlesToReturn;

  }

  async addCoordinatesPuzzle(coordinatesPuzzle: CoordinatesPuzzle): Promise<string> {
    const docRef = await addDoc(collection(this.db, 'coordinatesPuzzles'), coordinatesPuzzle);
    return docRef.id;
  }




  /**
   // ----------------------------------------------------------------------------
    User Puzzles
   */


  /**
   * Gets the puzzles that the user has made
   * Obtiene los problemas que el usuario a realizado
   *
   * @param uidUser
   * @returns
   */
  async getUserPuzzlesByUidUser(uidUser: string): Promise<UserPuzzle[]> {
    const userPuzzlesToReturn: UserPuzzle[] = [];
    const q = query(
      collection(this.db, 'userPuzzles'),
      where('uidUser', '==', uidUser)
    );
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach((document) => {
      const userPuzzleToAdd = document.data() as UserPuzzle;
      userPuzzleToAdd.uid = document.id;
      userPuzzlesToReturn.push(userPuzzleToAdd);
    });

    return userPuzzlesToReturn;

  }


  /**
   * Add one Puzzle done
   * Adiciona un puzzle realizado
   *
   * @param userPuzzle
   * @returns
   */
  async addOneUserPuzzle(userPuzzle: UserPuzzle): Promise<string> {
    const docRef = await addDoc(collection(this.db, 'userPuzzles'), userPuzzle);
    return docRef.id;
  }


  /**
   // ----------------------------------------------------------------------------
    Plan
   */

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
      collection(this.db, 'plans'),
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
    return setDoc(doc(this.db, 'plans', plan.uid), plan);
  }



  /**
   * Get plasElos from firestore
   *
   * @param uidUser
   * @returns PlanElos[]
   * */

  async getPlansElos(uidUser: string): Promise<PlanElos[]> {
    const plansToReturn: PlanElos[] = [];
    const q = query(
      collection(this.db, 'plansElos'),
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
      collection(this.db, 'plansElos'),
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
    return setDoc(doc(this.db, 'plansElos', planElo.uid), planElo);
  }

  /**
   * Update a planElo in firestore
   *
   * @param planElo
   * @returns
   * */
  async updatePlanElo(planElo: PlanElos) {
    return updateDoc(doc(this.db, 'plansElos', planElo.uid), { ...planElo });
  }


  /**
 // ----------------------------------------------------------------------------
  Custom Plan's
   */
  /**
   * Get custom plans from firestore
   *
   * @param plan
   * @returns
   * */
  async saveCustomPlan(plan: Plan): Promise<string | void> {
    return setDoc(doc(this.db, 'custom-plans', plan.uid), plan);
  }


  /**
   * Get custom plans from firestore
   *
   * @param uidUser
   * @returns CustomPlan[]
   * */

  async getCustomPlans(uidUser: string): Promise<Plan[]> {
    const plansToReturn: Plan[] = [];
    const q = query(
      collection(this.db, 'custom-plans'),
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
    const ref = doc(this.db, 'custom-plans', uid);
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
    return updateDoc(doc(this.db, 'custom-plans', customPlan.uid), { ...customPlan });
  }


  /**
   // ----------------------------------------------------------------------------
   Public Plans
   */

  /**
   * Sincroniza/duplica plan completo a public-plans
   * Si isPublic=true, marca como activo. Si isPublic=false, marca como inactivo (no elimina)
   */
  async syncPlanToPublic(plan: Plan): Promise<void> {
    const publicPlanRef = doc(this.db, 'public-plans', plan.uid);
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
      collection(this.db, 'public-plans'),
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
      const lastDocRef = doc(this.db, 'public-plans', lastPlanUid);
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
   * Helper para serializar datos de Firestore y evitar problemas con objetos congelados
   */
  private serializeFirestoreData<T>(data: any): T {
    try {
      return JSON.parse(JSON.stringify(data)) as T;
    } catch (e) {
      console.error('Error serializing Firestore data:', e);
      // Fallback: crear copia manual
      if (data === null || data === undefined) {
        return data as T;
      }
      if (typeof data !== 'object') {
        return data as T;
      }
      if (Array.isArray(data)) {
        return data.map(item => this.serializeFirestoreData(item)) as T;
      }
      const copy: any = {};
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          try {
            copy[key] = this.serializeFirestoreData(data[key]);
          } catch (err) {
            // Omitir propiedades problemáticas
            continue;
          }
        }
      }
      return copy as T;
    }
  }

  /**
   * Obtiene un plan público específico
   */
  async getPublicPlan(planUid: string): Promise<PublicPlan | null> {
    const ref = doc(this.db, 'public-plans', planUid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const dataRaw = snap.data();
    const data = this.serializeFirestoreData<PublicPlan>(dataRaw);
    data.uid = snap.id;
    return data;
  }

  /**
   * Obtiene todas las interacciones del usuario
   */
  async getUserPlanInteractions(uidUser: string): Promise<PlanInteraction[]> {
    const interactionsToReturn: PlanInteraction[] = [];
    const q = query(
      collection(this.db, 'plan-interactions'),
      where('uidUser', '==', uidUser)
    );
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach((document) => {
      const dataRaw = document.data();
      const interactionToAdd = this.serializeFirestoreData<PlanInteraction>(dataRaw);
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
      collection(this.db, 'plan-interactions'),
      where('uidUser', '==', uidUser),
      where(type, '==', true)
    );
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach((document) => {
      const dataRaw = document.data();
      const interactionToAdd = this.serializeFirestoreData<PlanInteraction>(dataRaw);
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
    const ref = doc(this.db, 'plan-interactions', interactionId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const dataRaw = snap.data();
    const data = this.serializeFirestoreData<PlanInteraction>(dataRaw);
    data.uid = snap.id;
    return data;
  }

  /**
   * Toggle me gusta y actualiza estadísticas
   * Validar que uidUser !== plan.uidUser (el creador no puede dar me gusta)
   */
  async togglePlanLike(uidUser: string, planUid: string, liked: boolean): Promise<void> {
    // Obtener el plan para validar que el usuario no sea el creador
    const publicPlan = await this.getPublicPlan(planUid);
    if (!publicPlan) {
      throw new Error('Plan público no encontrado');
    }
    if (publicPlan.uidUser === uidUser) {
      throw new Error('El creador del plan no puede dar me gusta a su propio plan');
    }

    const interactionId = `${uidUser}_${planUid}`;
    const interactionRef = doc(this.db, 'plan-interactions', interactionId);
    const interactionSnap = await getDoc(interactionRef);

    const publicPlanRef = doc(this.db, 'public-plans', planUid);

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
      await this.incrementPlanStats(planUid, 'likesCount');
    } else {
      await this.decrementPlanStats(planUid, 'likesCount');
    }
  }

  /**
   * Marca plan como jugado y actualiza estadísticas
   */
  async markPlanAsPlayed(uidUser: string, planUid: string): Promise<void> {
    const interactionId = `${uidUser}_${planUid}`;
    const interactionRef = doc(this.db, 'plan-interactions', interactionId);
    const interactionSnap = await getDoc(interactionRef);

    const publicPlanRef = doc(this.db, 'public-plans', planUid);

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
      await this.incrementPlanStats(planUid, 'timesPlayed');
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
    const interactionRef = doc(this.db, 'plan-interactions', interactionId);
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
      await this.incrementPlanStats(planUid, 'savedCount');
    } else {
      await this.decrementPlanStats(planUid, 'savedCount');
    }
  }

  /**
   * Incrementa estadística del plan
   */
  async incrementPlanStats(
    planUid: string,
    field: 'timesPlayed' | 'likesCount' | 'savedCount'
  ): Promise<void> {
    const publicPlanRef = doc(this.db, 'public-plans', planUid);
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
    const publicPlanRef = doc(this.db, 'public-plans', planUid);
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
