import { Injectable, inject } from '@angular/core';

/** Firebase Modules **/
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from 'firebase/firestore';

import { FirestoreConnection } from '@core/firestore/firestore-connection.service';
import {
  GameReflection,
  GameTag,
} from '@features/game-reflection/models/game-reflection.model';

/**
 * Repositorio de las reflexiones sobre partidas y de los tags propios del
 * usuario. Van como subcolecciones de su perfil:
 *
 *   Users/{uid}/gameReflections/{gameKey}   una por partida
 *   Users/{uid}/gameTags/{tagId}            los tags que creó
 *
 * El id de la reflexión es la clave de la partida (`lichess:q7ZvsdUF`), así que
 * volver a guardar la misma partida sobrescribe y no duplica, y sobrevive a
 * reinstalar la app.
 *
 * Métodos: getReflection, getReflections, saveReflection, deleteReflection, getTags, saveTag.
 *
 * Consumido por: GameReflectionService.
 */
@Injectable({
  providedIn: 'root',
})
export class GameReflectionRepository {
  private connection = inject(FirestoreConnection);

  /** La reflexión de una partida, o null si aún no se anotó nada. */
  async getReflection(uid: string, gameKey: string): Promise<GameReflection | null> {
    const snapshot = await getDoc(
      doc(this.connection.db, 'Users', uid, 'gameReflections', gameKey)
    );
    return snapshot.exists() ? (snapshot.data() as GameReflection) : null;
  }

  async getReflections(uid: string): Promise<GameReflection[]> {
    const snapshot = await getDocs(
      collection(this.connection.db, 'Users', uid, 'gameReflections')
    );
    const reflections: GameReflection[] = [];
    snapshot.forEach((document) => {
      reflections.push(document.data() as GameReflection);
    });
    return reflections;
  }

  saveReflection(uid: string, reflection: GameReflection): Promise<void> {
    return setDoc(
      doc(this.connection.db, 'Users', uid, 'gameReflections', reflection.gameKey),
      reflection
    );
  }

  deleteReflection(uid: string, gameKey: string): Promise<void> {
    return deleteDoc(
      doc(this.connection.db, 'Users', uid, 'gameReflections', gameKey)
    );
  }

  async getTags(uid: string): Promise<GameTag[]> {
    const snapshot = await getDocs(
      collection(this.connection.db, 'Users', uid, 'gameTags')
    );
    const tags: GameTag[] = [];
    snapshot.forEach((document) => {
      tags.push(document.data() as GameTag);
    });
    return tags;
  }

  saveTag(uid: string, tag: GameTag): Promise<void> {
    return setDoc(doc(this.connection.db, 'Users', uid, 'gameTags', tag.id), tag);
  }
}
