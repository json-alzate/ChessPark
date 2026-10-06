import { Injectable, inject } from '@angular/core';

/** Firebase Modules **/
import {
  DocumentReference,
  DocumentData,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  collection, query, where, getDocs,
} from 'firebase/firestore';

import { Profile } from '@cpark/models';
import { FirestoreConnection } from './firestore-connection.service';

/**
 * Repositorio del agregado Perfil: colección `Users` y la colección de
 * `nickNames` que reserva apodos únicos.
 *
 * Métodos: getProfile, createProfile, updateProfile, checkNickname,
 * addNewNickName.
 *
 * `updateProfile` escribe sobre el documento que dejó `getProfile` en la
 * última lectura; por eso el repositorio guarda la referencia. Es estado de
 * instancia y depende de que ProfileService (singleton) lea antes de escribir.
 *
 * Consumido por: ProfileService.
 */
@Injectable({
  providedIn: 'root'
})
export class ProfileRepository {

  private connection = inject(FirestoreConnection);
  private profileDocRef!: DocumentReference<DocumentData>;

  /**
   * Get a user from Firestore
   *
   * @param uid
   * @returns Promise<User>
   */
  async getProfile(uid: string): Promise<Profile> {

    this.profileDocRef = doc(this.connection.db, 'Users', uid);
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
    return setDoc(doc(this.connection.db, 'Users', profile.uid), profile);
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
      collection(this.connection.db, 'nickNames'),
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
    const docRef = await addDoc(collection(this.connection.db, 'nickNames'), {
      nickname,
      uidUser
    });
    return docRef.id;
  }

}
