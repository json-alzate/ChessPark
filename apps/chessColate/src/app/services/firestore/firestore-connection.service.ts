import { Injectable } from '@angular/core';

/** Firebase Modules **/
import { getApp } from 'firebase/app';
import {
  Firestore,
  FirestoreSettings,
  getFirestore,
  initializeFirestore,
} from 'firebase/firestore';

/**
 * Conexión única a Firestore compartida por todos los repositorios de
 * `services/`.
 *
 * Se configura una sola vez en `init()`, que AppComponent llama al arrancar
 * antes de que cualquier repositorio lea datos. La opción `useFetchStreams:
 * false` vive aquí para que todos los repositorios usen la misma conexión.
 *
 * Consumido por: ProfileRepository, UserPuzzleRepository, PlanRepository,
 * PlanElosRepository, CustomPlanRepository, PublicPlanRepository,
 * PlanInteractionRepository. Los componentes no la usan.
 */
@Injectable({
  providedIn: 'root'
})
export class FirestoreConnection {

  private _db!: Firestore;

  async init(): Promise<void> {
    const firestoreSettings: FirestoreSettings & { useFetchStreams: boolean } = {
      useFetchStreams: false
    };
    initializeFirestore(getApp(), firestoreSettings);
    this._db = getFirestore(getApp());
  }

  /** Instancia de Firestore; válida solo después de `init()`. */
  get db(): Firestore {
    return this._db;
  }
}
