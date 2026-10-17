import { COOKIES_PER_HEART, MAX_HEARTS, MAX_STRIKES } from '@features/chess-runner/config/runner.config';
import { RunnerSession } from '@features/chess-runner/game/runner-session';

describe('RunnerSession', () => {
  it('empieza con todos los corazones y nada más', () => {
    const sesion = new RunnerSession();

    expect(sesion.hearts).toBe(MAX_HEARTS);
    expect([sesion.strikes, sesion.solved, sesion.meters, sesion.cookies, sesion.cookieStreak]).toEqual([0, 0, 0, 0, 0]);
    expect(sesion.outOfStrikes).toBe(false);
  });

  it('cada choque cuesta un corazón; el último avisa de que se acabó', () => {
    const sesion = new RunnerSession();

    expect(sesion.loseHeart()).toBe(false);
    expect(sesion.loseHeart()).toBe(false);
    expect(sesion.hearts).toBe(1);
    expect(sesion.loseHeart()).toBe(true);
    expect(sesion.hearts).toBe(0);
    // No baja de cero
    expect(sesion.loseHeart()).toBe(true);
    expect(sesion.hearts).toBe(0);
  });

  it('curar devuelve cuántos corazones recuperó de verdad, sin pasar del máximo', () => {
    const sesion = new RunnerSession();
    expect(sesion.heal()).toBe(0);

    sesion.loseHeart();
    sesion.loseHeart();
    expect(sesion.heal()).toBe(1);
    expect(sesion.heal(5)).toBe(1);
    expect(sesion.hearts).toBe(MAX_HEARTS);
  });

  it('resolver un ejercicio suma uno y cura un corazón', () => {
    const sesion = new RunnerSession();
    sesion.loseHeart();

    sesion.recordSolved();

    expect(sesion.solved).toBe(1);
    expect(sesion.hearts).toBe(MAX_HEARTS);
  });

  it('fallar tres ejercicios agota los fallos', () => {
    const sesion = new RunnerSession();

    expect(sesion.recordFailed()).toBe(false);
    expect(sesion.recordFailed()).toBe(false);
    expect(sesion.recordFailed()).toBe(true);
    expect(sesion.strikes).toBe(MAX_STRIKES);
    expect(sesion.outOfStrikes).toBe(true);
  });

  describe('galletas', () => {
    it('suman en total y hacia el próximo corazón', () => {
      const sesion = new RunnerSession();

      expect(sesion.addCookies(7)).toBe(0);
      sesion.addCookies(5);

      expect(sesion.cookies).toBe(12);
      expect(sesion.cookieStreak).toBe(12);
    });

    it('al juntar las suficientes devuelven un corazón y la cuenta sigue con el resto', () => {
      const sesion = new RunnerSession();
      sesion.loseHeart();

      const curados = sesion.addCookies(COOKIES_PER_HEART + 4);

      expect(curados).toBe(1);
      expect(sesion.hearts).toBe(MAX_HEARTS);
      expect(sesion.cookieStreak).toBe(4);
      expect(sesion.cookies).toBe(COOKIES_PER_HEART + 4);
    });

    it('con los corazones llenos la cuenta se reinicia pero no hay corazón de más', () => {
      const sesion = new RunnerSession();

      expect(sesion.addCookies(COOKIES_PER_HEART)).toBe(0);

      expect(sesion.hearts).toBe(MAX_HEARTS);
      expect(sesion.cookieStreak).toBe(0);
    });

    it('muchas de golpe pueden devolver más de un corazón', () => {
      const sesion = new RunnerSession();
      sesion.loseHeart();
      sesion.loseHeart();

      expect(sesion.addCookies(COOKIES_PER_HEART * 3)).toBe(2);
      expect(sesion.hearts).toBe(MAX_HEARTS);
    });
  });

  describe('reglas ajustables (los poderes las cambian)', () => {
    it('resolver un ejercicio puede curar más de un corazón (la corona)', () => {
      const sesion = new RunnerSession({ maxHearts: 4, cookiesPerHeart: COOKIES_PER_HEART, solveHeal: 2 });
      sesion.loseHeart();
      sesion.loseHeart();
      sesion.loseHeart();

      sesion.recordSolved();

      expect(sesion.hearts).toBe(3);
    });

    it('sin indicarlo, cura uno', () => {
      const sesion = new RunnerSession({ maxHearts: 3, cookiesPerHeart: COOKIES_PER_HEART });
      sesion.loseHeart();
      sesion.loseHeart();

      sesion.recordSolved();

      expect(sesion.hearts).toBe(2);
    });

    it('las reglas se pueden cambiar a mitad de partida (un poder nuevo)', () => {
      const sesion = new RunnerSession();
      sesion.rules = { maxHearts: 4, cookiesPerHeart: 40 };
      sesion.hearts += 1;

      expect(sesion.hearts).toBe(4);
      expect(sesion.addCookies(40)).toBe(0);
      expect(sesion.cookieStreak).toBe(0);
    });

    it('un máximo de corazones mayor da más vidas', () => {
      const sesion = new RunnerSession({ maxHearts: 4, cookiesPerHeart: COOKIES_PER_HEART });

      expect(sesion.hearts).toBe(4);
      sesion.loseHeart();
      expect(sesion.heal(3)).toBe(1);
    });

    it('menos galletas por corazón los devuelve antes', () => {
      const sesion = new RunnerSession({ maxHearts: 3, cookiesPerHeart: 20 });
      sesion.loseHeart();

      expect(sesion.addCookies(20)).toBe(1);
    });
  });
});
