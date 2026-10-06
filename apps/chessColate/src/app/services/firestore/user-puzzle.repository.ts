import { Injectable, inject } from '@angular/core';

/** Firebase Modules **/
import {
  addDoc,
  collection, query, where, getDocs,
} from 'firebase/firestore';

import { CoordinatesPuzzle, UserPuzzle } from '@cpark/models';
import { FirestoreConnection } from './firestore-connection.service';

/**
 * Repositorio del historial de puzzles del usuario: `coordinatesPuzzles`
 * (ejercicios de coordenadas) y `userPuzzles` (puzzles resueltos).
 *
 * Métodos: getCoordinatesPuzzles, addCoordinatesPuzzle,
 * getUserPuzzlesByUidUser, addOneUserPuzzle.
 *
 * Consumido por: nadie dentro de la app hoy. Se mantiene el acceso completo al
 * agregado para que las estadísticas de puzzles puedan usarlo sin reescribirlo.
 */
@Injectable({
  providedIn: 'root'
})
export class UserPuzzleRepository {

  private connection = inject(FirestoreConnection);

  async getCoordinatesPuzzles(uidUser: string): Promise<CoordinatesPuzzle[]> {
    const coordinatesPuzzlesToReturn: CoordinatesPuzzle[] = [];
    const q = query(
      collection(this.connection.db, 'coordinatesPuzzles'),
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
    const docRef = await addDoc(collection(this.connection.db, 'coordinatesPuzzles'), coordinatesPuzzle);
    return docRef.id;
  }


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
      collection(this.connection.db, 'userPuzzles'),
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
    const docRef = await addDoc(collection(this.connection.db, 'userPuzzles'), userPuzzle);
    return docRef.id;
  }

}
