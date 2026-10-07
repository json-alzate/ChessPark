import { Injectable } from '@angular/core';

import { Block, Plan, UserPuzzle } from '@cpark/models';

import { addPuzzlePlayedToPlan } from './user-puzzle.util';

/**
 * Qué toca después de cerrar un ejercicio: otro ejercicio del mismo bloque,
 * el bloque siguiente, o ya no quedan bloques y hay que cerrar el plan.
 */
export type TrainingSessionNextStep =
  | 'next-puzzle'
  | 'next-block'
  | 'plan-finished';

/**
 * Máquina de estados del flujo de una sesión de entrenamiento: qué plan se
 * juega, en qué bloque va, cuántos ejercicios lleva ese bloque y, tras cada
 * resultado, si toca otro ejercicio, el bloque siguiente o el fin del plan.
 *
 * Recibe el plan al arrancar (`start`) y el registro de cada ejercicio jugado
 * (`registerPuzzleResult`). Devuelve decisiones (`advanceToNextBlock`,
 * `nextStepAfterPuzzle`) y expone el estado que la pantalla pinta: plan,
 * índice del bloque, contadores y si hay un cambio de bloque en curso.
 *
 * No sabe de cronómetros, sonidos, modales, analítica, persistencia ni
 * navegación: todo eso lo ejecuta la pantalla, en el orden que le toca, a
 * partir de lo que decide aquí. Por eso el único dato externo que entra en una
 * decisión es si el tiempo del bloque ya venció, y entra como parámetro.
 *
 * Ciclo de vida: se provee en el `providers` del componente de entrenamiento,
 * no en root, para que cada pantalla arranque con una sesión limpia y el
 * estado muera con ella. En root, una segunda instancia de la pantalla (la
 * ruta admite `returnTo` y con el outlet de Ionic la anterior puede seguir
 * viva) compartiría índice y contadores. Aun así, Ionic reutiliza la misma
 * instancia de pantalla entre rutinas (la conserva bajo la pantalla de
 * resumen), así que `start` y `reset` dejan la sesión como recién creada en
 * vez de confiar en el constructor.
 */
@Injectable()
export class TrainingSessionService {
  private _plan: Plan | null = null;
  /** -1 es "antes del primer bloque": el primer avance lo deja en 0. */
  private _currentIndexBlock = -1;
  private _countPuzzlesPlayedBlock = 0;
  private _totalPuzzlesInBlock = 0;
  /**
   * Hay un cambio de bloque a medias (su presentación sigue abierta). Mientras
   * dure, los resultados que lleguen del tablero son de un ejercicio del bloque
   * anterior y se descartan: anotarlos iría al bloque equivocado.
   */
  private _isChangingBlock = false;

  /**
   * Plan en curso, o `null` hasta que llega el primero. El setter existe
   * porque la pantalla le añade datos de cierre (elo inicial, usuario,
   * terminado) con copias nuevas del plan; la posición no cambia con ello.
   */
  get plan(): Plan | null {
    return this._plan;
  }

  set plan(plan: Plan | null) {
    this._plan = plan;
  }

  /** Bloques del plan en el orden en que se juegan; vacío sin plan. */
  get blocks(): Block[] {
    return this._plan?.blocks ?? [];
  }

  /**
   * Índice del bloque en juego dentro de `blocks`. El setter permite montar la
   * sesión en un bloque concreto (pruebas, restauraciones); el flujo normal
   * avanza con `advanceToNextBlock`.
   */
  get currentIndexBlock(): number {
    return this._currentIndexBlock;
  }

  set currentIndexBlock(index: number) {
    this._currentIndexBlock = index;
  }

  /** Bloque en juego, o `undefined` antes del primero y después del último. */
  get currentBlock(): Block | undefined {
    return this.blocks[this._currentIndexBlock];
  }

  /** Ejercicios ya cerrados en el bloque en juego (resueltos o no). */
  get countPuzzlesPlayedBlock(): number {
    return this._countPuzzlesPlayedBlock;
  }

  set countPuzzlesPlayedBlock(count: number) {
    this._countPuzzlesPlayedBlock = count;
  }

  /** Cuota de ejercicios del bloque en juego; 0 cuando el bloque es por tiempo. */
  get totalPuzzlesInBlock(): number {
    return this._totalPuzzlesInBlock;
  }

  set totalPuzzlesInBlock(total: number) {
    this._totalPuzzlesInBlock = total;
  }

  /** Ver `_isChangingBlock`. */
  get isChangingBlock(): boolean {
    return this._isChangingBlock;
  }

  /**
   * El bloque en juego es por cantidad y ya se jugaron todos sus ejercicios.
   * Un bloque por tiempo (cuota 0) nunca se completa por aquí: lo cierra el
   * reloj.
   */
  get isBlockQuotaReached(): boolean {
    const block = this.currentBlock;
    return (
      !!block &&
      block.puzzlesCount !== 0 &&
      this._countPuzzlesPlayedBlock === block.puzzlesCount
    );
  }

  /**
   * Adopta un plan y coloca la sesión antes de su primer bloque, con los
   * contadores a cero. No toca un cambio de bloque en curso: ese estado lo
   * cierra quien abrió la presentación, y quien arranca un plan comprueba
   * antes que no lo haya.
   */
  start(plan: Plan): void {
    this._plan = plan;
    this._currentIndexBlock = -1;
    this._countPuzzlesPlayedBlock = 0;
    this._totalPuzzlesInBlock = 0;
  }

  /**
   * Pasa al bloque siguiente y abre el cambio de bloque. Si ya no quedan
   * bloques, el índice queda en `blocks.length` y el cambio se cierra en el
   * acto: no hay presentación que esperar.
   *
   * @returns `'next-block'` con el bloque listo para presentarse, o
   * `'plan-finished'` si se jugó el último.
   */
  advanceToNextBlock(): Extract<
    TrainingSessionNextStep,
    'next-block' | 'plan-finished'
  > {
    this._isChangingBlock = true;
    this._currentIndexBlock++;

    const block = this.currentBlock;
    if (!block) {
      this._isChangingBlock = false;
      return 'plan-finished';
    }

    this._totalPuzzlesInBlock = block.puzzlesCount;
    this._countPuzzlesPlayedBlock = 0;
    return 'next-block';
  }

  /**
   * Cierra el cambio de bloque: el bloque ya está presentado y la sesión
   * vuelve a aceptar resultados del tablero.
   */
  blockReady(): void {
    this._isChangingBlock = false;
  }

  /**
   * Anota un ejercicio cerrado en el bloque en juego: suma al contador y lo
   * añade a `puzzlesPlayed` en una copia nueva del plan y del bloque (el resto
   * de bloques se comparte). Sin plan o sin bloque en juego no anota nada.
   */
  registerPuzzleResult(userPuzzle: UserPuzzle): void {
    if (!this._plan || !this.currentBlock) {
      return;
    }
    this._countPuzzlesPlayedBlock++;
    this._plan = addPuzzlePlayedToPlan(
      this._plan,
      this._currentIndexBlock,
      userPuzzle
    );
  }

  /**
   * Decide qué toca una vez cerrado el ejercicio (resuelto, fallado o con su
   * solución ya vista).
   *
   * El tiempo manda: si el bloque venció mientras se jugaba o se veía la
   * solución, toca el bloque siguiente aunque la cuota no esté completa. Sin
   * bloque en juego no queda nada que servir y el plan se cierra. Con la
   * cuota completa toca el bloque siguiente; si no, otro ejercicio.
   *
   * @param blockTimeExpired Si el reloj del bloque ya se agotó; lo sabe la
   * pantalla, que es quien lleva el cronómetro.
   */
  nextStepAfterPuzzle(blockTimeExpired: boolean): TrainingSessionNextStep {
    if (blockTimeExpired) {
      return 'next-block';
    }
    if (!this.currentBlock) {
      return 'plan-finished';
    }
    if (this.isBlockQuotaReached) {
      return 'next-block';
    }
    return 'next-puzzle';
  }

  /**
   * Vuelve a antes del primer bloque y cierra cualquier cambio en curso. El
   * plan se conserva a propósito: al terminar una rutina la pantalla de
   * resumen lo sigue leyendo, y la pantalla de entrenamiento lo usa para
   * distinguir "nunca hubo plan" de "el store se vació después de jugar".
   */
  reset(): void {
    this._currentIndexBlock = -1;
    this._countPuzzlesPlayedBlock = 0;
    this._totalPuzzlesInBlock = 0;
    this._isChangingBlock = false;
  }
}
