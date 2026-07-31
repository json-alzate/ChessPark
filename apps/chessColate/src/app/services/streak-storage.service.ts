import { Injectable } from '@angular/core';

import { StreakRecord, StreakRun } from '@cpark/models';

import { applyRunToRecord, emptyStreakRecord } from './streak.util';

/**
 * Persistencia local del modo Racha: récord personal y las últimas rachas
 * jugadas. Todo en localStorage, igual que el récord del Reto 333 y el resto
 * del estado local de la app.
 */
@Injectable({
  providedIn: 'root',
})
export class StreakStorageService {
  private readonly RECORD_KEY = 'chessColate_streak_record';
  private readonly RUNS_KEY = 'chessColate_streak_runs';

  /** Cuántas rachas recientes se conservan (solo para estadísticas locales). */
  private readonly MAX_STORED_RUNS = 20;

  getRecord(): StreakRecord {
    try {
      const json = localStorage.getItem(this.RECORD_KEY);
      if (!json) {
        return emptyStreakRecord();
      }
      // Merge con el récord vacío para tolerar datos de versiones previas
      return { ...emptyStreakRecord(), ...JSON.parse(json) };
    } catch (error) {
      console.error('Error al leer el récord de la racha:', error);
      return emptyStreakRecord();
    }
  }

  /** Guarda la racha terminada y devuelve el récord ya actualizado. */
  saveRun(run: StreakRun): StreakRecord {
    const record = applyRunToRecord(this.getRecord(), run);

    try {
      localStorage.setItem(this.RECORD_KEY, JSON.stringify(record));
    } catch (error) {
      console.error('Error al guardar el récord de la racha:', error);
    }

    this.appendRun(run);
    return record;
  }

  getRuns(): StreakRun[] {
    try {
      const json = localStorage.getItem(this.RUNS_KEY);
      if (!json) {
        return [];
      }
      const runs = JSON.parse(json);
      return Array.isArray(runs) ? runs : [];
    } catch (error) {
      console.error('Error al leer las rachas guardadas:', error);
      return [];
    }
  }

  private appendRun(run: StreakRun): void {
    // Sin los uids de los puzzles: solo sirven para no repetir dentro de la
    // racha en curso y engordarían el localStorage sin aportar nada después.
    const runs = [{ ...run, puzzleUids: [] }, ...this.getRuns()].slice(
      0,
      this.MAX_STORED_RUNS
    );
    try {
      localStorage.setItem(this.RUNS_KEY, JSON.stringify(runs));
    } catch (error) {
      console.error('Error al guardar la racha:', error);
    }
  }
}
