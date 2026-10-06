import { Injectable } from '@angular/core';

import { Reto333Record } from '@cpark/models';

/** Resultado de un intento, tal y como lo entrega la pantalla de entrenamiento. */
export interface Reto333Attempt {
  /** Puzzles resueltos. */
  score: number;
  /** Elo al que llegó la rampa. */
  maxElo: number;
  /** Duración en segundos. */
  timeSeconds: number;
  /** Duración ya formateada para mostrar. */
  timeString: string;
  /** Si llegó a los 333. */
  completed: boolean;
}

/**
 * Persistencia local de la marca del Reto 333.
 *
 * El dispositivo es la copia rápida: se lee sin red y sin esperar a que
 * resuelva la sesión. Cuando hay usuario, [UserRecordsService] la sincroniza
 * con la copia del perfil en Firestore.
 */
@Injectable({
  providedIn: 'root',
})
export class Reto333StorageService {
  /** Clave histórica: se mantiene para no perder las marcas ya guardadas. */
  private readonly RECORD_KEY = 'chesscolate_reto333_stats';

  /** `null` si nunca se ha jugado: la tarjeta del inicio distingue ese caso. */
  getRecord(): Reto333Record | null {
    try {
      const json = localStorage.getItem(this.RECORD_KEY);
      if (!json) {
        return null;
      }
      return this.normalize(JSON.parse(json));
    } catch (error) {
      console.error('Error al leer la marca del Reto 333:', error);
      return null;
    }
  }

  setRecord(record: Reto333Record): void {
    try {
      localStorage.setItem(this.RECORD_KEY, JSON.stringify(record));
    } catch (error) {
      console.error('Error al guardar la marca del Reto 333:', error);
    }
  }

  /** Borra la marca del dispositivo (por ejemplo si era de otra cuenta). */
  clear(): void {
    try {
      localStorage.removeItem(this.RECORD_KEY);
    } catch (error) {
      console.error('Error al borrar la marca del Reto 333:', error);
    }
  }

  /** Aplica un intento terminado a la marca y devuelve la marca ya actualizada. */
  saveAttempt(attempt: Reto333Attempt, uidUser?: string): Reto333Record {
    const previous = this.getRecord();
    const record: Reto333Record = {
      uidUser: uidUser ?? previous?.uidUser,
      lastScore: attempt.score,
      bestScore: Math.max(previous?.bestScore ?? 0, attempt.score),
      maxElo: attempt.maxElo,
      lastTime: attempt.timeSeconds,
      timeString: attempt.timeString,
      completed: attempt.completed,
      lastPlayedAt: Date.now(),
    };

    this.setRecord(record);
    return record;
  }

  /**
   * Completa los campos que faltan. Las marcas guardadas antes de que existiera
   * la sincronización no traen ni dueño ni fecha, y sin esto romperían la
   * comparación con la copia de la nube.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalize(raw: any): Reto333Record {
    return {
      uidUser: typeof raw?.uidUser === 'string' ? raw.uidUser : undefined,
      lastScore: Number(raw?.lastScore) || 0,
      bestScore: Number(raw?.bestScore) || 0,
      maxElo: Number(raw?.maxElo) || 0,
      lastTime: Number(raw?.lastTime) || 0,
      timeString: typeof raw?.timeString === 'string' ? raw.timeString : '',
      completed: !!raw?.completed,
      lastPlayedAt: Number(raw?.lastPlayedAt) || 0,
    };
  }
}
