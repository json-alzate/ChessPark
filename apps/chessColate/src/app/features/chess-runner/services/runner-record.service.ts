import { Injectable } from '@angular/core';

import { RunnerCampaign } from '../campaign/runner-campaign.model';
import { newCampaign, sanitizeCampaign } from '../campaign/runner-campaign.util';

/**
 * Lo único que el Chess Runner recuerda en el dispositivo (`localStorage`, sin sincronizar con el perfil):
 * - el **récord** de distancia (en metros) de una partida, como el del dinosaurio de Chrome;
 * - la **campaña**: el capítulo en el que va, lo que domina de cada patrón, los poderes ganados y lo que ya vio de
 *   la historia.
 * Sin acceso al almacenamiento el juego sigue, sin récord ni progreso guardado.
 */
@Injectable({ providedIn: 'root' })
export class RunnerRecordService {
  private readonly RECORD_KEY = 'chessColate_runner_best_m';
  private readonly CAMPAIGN_KEY = 'chessColate_runner_campaign';

  /** Mejor distancia guardada, en metros (0 si no hay). */
  best(): number {
    try {
      const value = Number(localStorage.getItem(this.RECORD_KEY));
      return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
    } catch {
      return 0;
    }
  }

  /** Guarda `meters` si supera el récord. Devuelve `true` si lo es. */
  save(meters: number): boolean {
    const value = Math.floor(meters);
    if (!(value > this.best())) {
      return false;
    }
    try {
      localStorage.setItem(this.RECORD_KEY, String(value));
    } catch (error) {
      console.error('Error al guardar el récord del runner:', error);
      return false;
    }
    return true;
  }

  /** La campaña guardada, o una nueva si no hay o está rota. */
  loadCampaign(): RunnerCampaign {
    try {
      const raw = localStorage.getItem(this.CAMPAIGN_KEY);
      return raw ? sanitizeCampaign(JSON.parse(raw)) : newCampaign();
    } catch {
      return newCampaign();
    }
  }

  saveCampaign(campaign: RunnerCampaign): void {
    try {
      localStorage.setItem(this.CAMPAIGN_KEY, JSON.stringify(campaign));
    } catch (error) {
      console.error('Error al guardar el progreso del runner:', error);
    }
  }
}
