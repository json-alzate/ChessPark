import { Injectable } from '@angular/core';

import {
  WoodpeckerProgress,
  WoodpeckerSet,
  WoodpeckerState,
} from '../models/woodpecker.model';
import { emptyProgress } from '../utils/woodpecker-cycle.util';
import {
  isWoodpeckerProgress,
  isWoodpeckerSet,
} from '../utils/woodpecker-validation.util';

/**
 * Persistencia local del Pájaro Carpintero: el set congelado y el progreso.
 *
 * Solo hay un set a la vez, y vive únicamente en el dispositivo (como el
 * historial de rutinas): sin sesión también se puede entrenar y no hace falta
 * red para seguir. El set y el progreso van en claves aparte porque el set
 * pesa cientos de KB y se escribe una vez, mientras que el progreso se
 * escribe tras cada ejercicio.
 */
@Injectable({
  providedIn: 'root',
})
export class WoodpeckerStorageService {
  private readonly SET_KEY = 'chessColate_woodpecker_set';
  private readonly PROGRESS_KEY = 'chessColate_woodpecker_progress';

  /** El set y su progreso, o `null` si no hay set (o está dañado). */
  getState(): WoodpeckerState | null {
    const set = this.read(this.SET_KEY, isWoodpeckerSet);
    if (!set) {
      return null;
    }

    const stored = this.read(this.PROGRESS_KEY, isWoodpeckerProgress);
    // Un progreso que no es de este set no sirve: se empieza de cero
    const progress = stored?.setId === set.id ? stored : emptyProgress(set.id);
    return { set, progress };
  }

  /**
   * Guarda un set nuevo con su progreso en blanco. Devuelve `false` si el
   * dispositivo no deja escribir (cuota llena); en ese caso no queda nada a
   * medias: lo anterior se conserva.
   */
  saveNewSet(set: WoodpeckerSet): boolean {
    const previousSet = localStorage.getItem(this.SET_KEY);
    const previousProgress = localStorage.getItem(this.PROGRESS_KEY);

    try {
      localStorage.setItem(this.SET_KEY, JSON.stringify(set));
      localStorage.setItem(this.PROGRESS_KEY, JSON.stringify(emptyProgress(set.id)));
      return true;
    } catch (error) {
      console.error('Error al guardar el set del Pájaro Carpintero:', error);
      this.restore(this.SET_KEY, previousSet);
      this.restore(this.PROGRESS_KEY, previousProgress);
      return false;
    }
  }

  saveProgress(progress: WoodpeckerProgress): boolean {
    try {
      localStorage.setItem(this.PROGRESS_KEY, JSON.stringify(progress));
      return true;
    } catch (error) {
      console.error('Error al guardar el progreso del Pájaro Carpintero:', error);
      return false;
    }
  }

  /** Borra el set y el progreso. */
  clear(): void {
    localStorage.removeItem(this.SET_KEY);
    localStorage.removeItem(this.PROGRESS_KEY);
  }

  private read<T>(key: string, isValid: (value: unknown) => value is T): T | null {
    try {
      const json = localStorage.getItem(key);
      if (!json) {
        return null;
      }
      const value: unknown = JSON.parse(json);
      return isValid(value) ? value : null;
    } catch (error) {
      console.error(`Error al leer ${key}:`, error);
      return null;
    }
  }

  private restore(key: string, previous: string | null): void {
    try {
      if (previous === null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, previous);
      }
    } catch {
      // Sin espacio incluso para restaurar: no hay nada más que hacer
    }
  }
}
