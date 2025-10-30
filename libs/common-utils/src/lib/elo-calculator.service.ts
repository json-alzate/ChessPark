import { Injectable } from '@angular/core';

export interface EloCalculationResult {
  newElo: number;
  change: number;
  expectedOutcome: number;
}

export interface EloCalculationOptions {
  kFactor?: number; // Factor K de Elo (por defecto 32)
}

@Injectable({
  providedIn: 'root'
})
export class EloCalculatorService {

  // Factores K comunes en diferentes sistemas
  static readonly K_FACTORS = {
    standard: 32,      // Estándar para jugadores sin clasificación fiable
    fide: 32,         // FIDE (Federación Internacional de Ajedrez) para menos de 30 juegos
    fideExperienced: 24, // FIDE para más de 30 juegos
    uscfBeginner: 32, // USCF para principiantes
    uscfClass: 24,    // USCF para clase C
    uscfExpert: 16    // USCF para expertos
  };

  /**
   * Calcula el nuevo ELO de un jugador después de jugar contra otro
   * @param playerElo ELO actual del jugador
   * @param opponentElo ELO del oponente
   * @param result Resultado del juego: 1 (victoria), 0.5 (empate), 0 (derrota)
   * @param options Opciones adicionales para el cálculo
   * @returns Objeto con el nuevo ELO, el cambio y la expectativa
   */
  calculateElo(
    playerElo: number,
    opponentElo: number,
    result: 1 | 0.5 | 0,
    options: EloCalculationOptions = {}
  ): EloCalculationResult {
    const kFactor = options.kFactor ?? EloCalculatorService.K_FACTORS.standard;

    // Calcular la expectativa de resultado para el jugador
    const expectedOutcome = this.calculateExpectedOutcome(playerElo, opponentElo);

    // Calcular el cambio en el ELO
    const change = kFactor * (result - expectedOutcome);

    // Calcular el nuevo ELO
    const newElo = Math.round(playerElo + change);

    return {
      newElo,
      change: Math.round(change),
      expectedOutcome
    };
  }

  /**
   * Calcula solo la expectativa de resultado entre dos jugadores
   * @param playerElo ELO del jugador
   * @param opponentElo ELO del oponente
   * @returns Expectativa de resultado (0-1)
   */
  calculateExpectedOutcome(playerElo: number, opponentElo: number): number {
    return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
  }

  /**
   * Calcula el ELO requerido para ganar una cantidad específica de puntos
   * @param currentElo ELO actual
   * @param desiredChange Cambio deseado en puntos
   * @param opponentElo ELO del oponente
   * @param kFactor Factor K a usar
   * @returns El resultado necesario (1, 0.5 o 0)
   */
  calculateRequiredResult(
    currentElo: number,
    desiredChange: number,
    opponentElo: number,
    kFactor: number = EloCalculatorService.K_FACTORS.standard
  ): 1 | 0.5 | 0 {
    const expectedOutcome = this.calculateExpectedOutcome(currentElo, opponentElo);
    const requiredResult = desiredChange / kFactor + expectedOutcome;

    // Determinar el resultado más cercano
    if (requiredResult >= 0.75) return 1;
    if (requiredResult >= 0.25) return 0.5;
    return 0;
  }

  /**
   * Calcula el ELO promedio de un grupo de jugadores
   * @param elos Array de ELOs
   * @returns ELO promedio redondeado
   */
  calculateAverageElo(elos: number[]): number {
    if (elos.length === 0) return 0;
    const sum = elos.reduce((acc, elo) => acc + elo, 0);
    return Math.round(sum / elos.length);
  }

  /**
   * Calcula el ELO ponderado basado en los resultados de múltiples partidas
   * @param games Array de juegos con ELO del oponente y resultado
   * @param options Opciones de cálculo
   * @returns ELO ponderado
   */
  calculateWeightedElo(
    games: Array<{ opponentElo: number; result: 1 | 0.5 | 0 }>,
    options: EloCalculationOptions = {}
  ): number {
    if (games.length === 0) return 1500; // ELO inicial estándar

    const kFactor = options.kFactor ?? EloCalculatorService.K_FACTORS.standard;
    const avgOpponentElo = this.calculateAverageElo(games.map(g => g.opponentElo));
    const avgResult = games.reduce((sum, g) => sum + g.result, 0) / games.length;

    const expectedOutcome = this.calculateExpectedOutcome(1500, avgOpponentElo);
    const totalChange = kFactor * (avgResult - expectedOutcome);

    return Math.round(1500 + totalChange);
  }

  /**
   * Determina la categoría ELO según los rangos estándar
   * @param elo ELO del jugador
   * @returns Nombre de la categoría
   */
  getEloCategory(elo: number): string {
    if (elo < 1200) return 'Principiante';
    if (elo < 1400) return 'Novato';
    if (elo < 1600) return 'Clase D';
    if (elo < 1800) return 'Clase C';
    if (elo < 2000) return 'Clase B';
    if (elo < 2200) return 'Clase A';
    if (elo < 2400) return 'Experto';
    if (elo < 2600) return 'Maestro Nacional';
    if (elo < 2700) return 'Maestro FIDE';
    return 'Gran Maestro';
  }

  /**
   * Valida si un ELO es válido
   * @param elo ELO a validar
   * @returns true si es válido
   */
  isValidElo(elo: number): boolean {
    return Number.isFinite(elo) && elo >= 0 && elo <= 4000;
  }
}

