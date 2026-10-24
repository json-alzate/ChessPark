import { COOKIES_PER_HEART, MAX_HEARTS, MAX_STRIKES, SCATTER_COOKIES } from '../config/runner.config';

/** Lo que cambia las reglas de una partida (los poderes del perrito lo ajustan). */
export interface SessionRules {
  maxHearts: number;
  cookiesPerHeart: number;
  /** Corazones que cura resolver un ejercicio. */
  solveHeal?: number;
}

export const DEFAULT_RULES: SessionRules = { maxHearts: MAX_HEARTS, cookiesPerHeart: COOKIES_PER_HEART };

/**
 * Una partida del Chess Runner: la cadena de carreras y ejercicios hasta perder. Lleva la cuenta de los corazones
 * (uno por choque), los ejercicios fallidos, los metros y las galletas. Sin Angular: la pantalla la usa y la prueba
 * no necesita pantalla.
 */
export class RunnerSession {
  hearts: number;
  strikes = 0;
  solved = 0;
  /** Metros de las carreras ya terminadas (la carrera en curso va aparte). */
  meters = 0;
  cookies = 0;
  /** Galletas que llevan hacia el próximo corazón. */
  cookieStreak = 0;

  constructor(public rules: SessionRules = DEFAULT_RULES) {
    this.hearts = rules.maxHearts;
  }

  /** Un choque cuesta un corazón. Devuelve `true` si era el último. */
  loseHeart(): boolean {
    this.hearts = Math.max(0, this.hearts - 1);
    return this.hearts === 0;
  }

  /** Recupera corazones hasta el máximo. Devuelve cuántos recuperó de verdad. */
  heal(count = 1): number {
    const before = this.hearts;
    this.hearts = Math.min(this.rules.maxHearts, this.hearts + count);
    return this.hearts - before;
  }

  /** Suma galletas; cada `cookiesPerHeart` devuelven un corazón. Devuelve los corazones recuperados. */
  addCookies(count: number): number {
    this.cookies += count;
    this.cookieStreak += count;
    let healed = 0;
    while (this.cookieStreak >= this.rules.cookiesPerHeart) {
      this.cookieStreak -= this.rules.cookiesPerHeart;
      healed += this.heal();
    }
    return healed;
  }

  /** Un choque hace saltar parte de las galletas que se llevaban hacia el próximo corazón. Devuelve cuántas se perdieron. */
  scatterCookies(max = SCATTER_COOKIES): number {
    const lost = Math.min(this.cookieStreak, max);
    this.cookieStreak -= lost;
    return lost;
  }

  recordSolved(): void {
    this.solved++;
    this.heal(this.rules.solveHeal ?? 1);
  }

  /** Cuenta un ejercicio fallido. Devuelve `true` si ya no quedan. */
  recordFailed(): boolean {
    this.strikes++;
    return this.outOfStrikes;
  }

  get outOfStrikes(): boolean {
    return this.strikes >= MAX_STRIKES;
  }
}
