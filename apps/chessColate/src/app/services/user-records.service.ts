import { inject, Injectable } from '@angular/core';

import { Reto333Record, StreakRecord, UserRecords } from '@cpark/models';

import { ProfileService } from './profile.service';
import { Reto333StorageService } from './reto333-storage.service';
import { StreakStorageService } from './streak-storage.service';
import {
  hasStreakData,
  isFromAnotherUser,
  mergeReto333Records,
  mergeStreakRecords,
  recordsEqual,
} from './user-records.util';

/**
 * Sincroniza las marcas del Reto 333 y del modo Racha entre el dispositivo y el
 * perfil del usuario en Firestore.
 *
 * El dispositivo sigue siendo la copia que se lee al pintar (inmediata y sin
 * red); la nube es la que hace que las marcas sobrevivan a un cambio de móvil o
 * a una reinstalación.
 *
 * Los récords viven **dentro del documento del perfil** (`Users/{uid}.records`):
 * son un puñado de números, llegan gratis con el perfil al iniciar sesión y no
 * necesitan una colección aparte ni reglas de seguridad nuevas.
 */
@Injectable({
  providedIn: 'root',
})
export class UserRecordsService {
  private profileService = inject(ProfileService);
  private streakStorage = inject(StreakStorageService);
  private reto333Storage = inject(Reto333StorageService);

  /**
   * Al iniciar sesión: fusiona lo que hay en el dispositivo con lo que trae el
   * perfil, deja el resultado en ambos lados y no escribe nada si ya coincidían.
   *
   * Sin sesión no hace nada: quien juega como invitado solo tiene la copia
   * local, y al registrarse se la lleva consigo.
   */
  async syncFromProfile(): Promise<void> {
    const profile = this.profileService.getProfile;
    const uidUser = profile?.uid;
    if (!uidUser) {
      return;
    }

    const remote = profile?.records ?? {};

    const localStreakRaw = this.streakStorage.getRecord();
    const localStreak = isFromAnotherUser(localStreakRaw, uidUser)
      ? null
      : localStreakRaw;

    const localReto333Raw = this.reto333Storage.getRecord();
    const localReto333 = isFromAnotherUser(localReto333Raw, uidUser)
      ? null
      : localReto333Raw;

    const streak = this.withOwner(
      mergeStreakRecords(localStreak, remote.streak),
      uidUser
    );
    const reto333 = this.withOwner(
      mergeReto333Records(localReto333, remote.reto333),
      uidUser
    );

    if (streak) {
      this.streakStorage.setRecord(streak);
    } else if (hasStreakData(localStreakRaw)) {
      // El récord local era de otra cuenta y esta no tiene nada: se limpia para
      // no enseñarle a este usuario marcas que no son suyas.
      this.streakStorage.setRecord({
        bestScore: 0,
        bestRunUid: '',
        achievedAt: 0,
        runsPlayed: 0,
        lastScore: 0,
        lastPlayedAt: 0,
        uidUser,
      });
    }

    if (reto333) {
      this.reto333Storage.setRecord(reto333);
    } else if (localReto333Raw) {
      this.reto333Storage.clear();
    }

    const upToDate =
      recordsEqual(streak, remote.streak ?? null) &&
      recordsEqual(reto333, remote.reto333 ?? null);
    if (upToDate) {
      return;
    }

    this.saveToProfile({ streak, reto333 });
  }

  /**
   * Sube al perfil lo que hay ahora mismo en el dispositivo. Se llama al
   * terminar una racha o un intento del Reto 333.
   *
   * No devuelve promesa a propósito: la escritura va por el store y no debe
   * hacer esperar a la pantalla de resultado.
   */
  push(): void {
    const uidUser = this.profileService.getProfile?.uid;
    if (!uidUser) {
      return;
    }

    const streakRecord = this.streakStorage.getRecord();
    this.saveToProfile({
      streak: this.withOwner(
        hasStreakData(streakRecord) ? streakRecord : null,
        uidUser
      ),
      reto333: this.withOwner(this.reto333Storage.getRecord(), uidUser),
    });
  }

  /**
   * Escribe los dos récords de una vez. Firestore reemplaza el objeto entero al
   * actualizar un campo con forma de mapa, así que mandar solo uno borraría el
   * otro.
   */
  private saveToProfile(records: {
    streak: StreakRecord | null;
    reto333: Reto333Record | null;
  }): void {
    // Se parte de lo que ya tiene el perfil: si el dispositivo solo conoce uno
    // de los dos récords, el otro se reescribe tal cual en vez de perderse.
    const toSave: UserRecords = { ...(this.profileService.getProfile?.records ?? {}) };
    if (records.streak) {
      toSave.streak = records.streak;
    }
    if (records.reto333) {
      toSave.reto333 = records.reto333;
    }

    if (!toSave.streak && !toSave.reto333) {
      return;
    }

    this.profileService.requestUpdateProfile({ records: toSave });
  }

  /** Firma el récord con el dueño y deja fuera los `undefined` que Firestore rechaza. */
  private withOwner<T extends { uidUser?: string }>(
    record: T | null,
    uidUser: string
  ): T | null {
    if (!record) {
      return null;
    }

    const owned = { ...record, uidUser } as T & Record<string, unknown>;
    Object.keys(owned).forEach((key) => {
      if (owned[key] === undefined) {
        delete owned[key];
      }
    });
    return owned;
  }
}
