import { Injectable, OnDestroy } from '@angular/core';

import {
  BehaviorSubject,
  interval,
  Observable,
  Subject,
  Subscription,
} from 'rxjs';

/**
 * Cuenta atrás del bloque de entrenamiento: segundos restantes, un tic por
 * segundo y un aviso cuando el bloque se agota.
 *
 * Recibe la duración en `start(segundos)`. Expone el tiempo restante de dos
 * formas: `timeLeft` para leerlo en el acto (la plantilla lo pinta en cada
 * detección de cambios) y `timeLeft$` como flujo para quien prefiera
 * reaccionar a cada tic. Avisa por `timeUp$` cuando el bloque se agota.
 * `pause()` congela el restante y `resume()` sigue desde ahí; `stop()` apaga
 * el reloj sin tocar el restante.
 *
 * Solo cuenta: no reproduce sonidos ni cambia de bloque. Quien escucha
 * `timeUp$` decide qué hacer, porque es quien sabe si hay una solución abierta
 * que deba verse antes de cambiar de bloque. Tampoco tiene umbral de "queda
 * poco tiempo": el aviso sonoro de la rutina responde al reloj de cada
 * ejercicio, que lleva el tablero, y no al del bloque.
 *
 * Vencimiento: llegar a 0 no agota el bloque; lo agota el tic siguiente. Así
 * el usuario ve 00:00 durante un segundo antes del cambio de bloque, y un
 * bloque de N segundos dura N+1 tics. Las pruebas de la pantalla fijan esa
 * cadencia.
 *
 * Nunca hay más de un reloj vivo: `start` apaga el anterior antes de arrancar
 * y el propio tic lo apaga al agotarse. Cuando llegó a haber dos (se
 * reemplazaba el Subject de cancelación en vez de la suscripción) el tiempo
 * bajaba al doble de velocidad y se saltaban bloques enteros.
 *
 * Ciclo de vida: se provee en el `providers` del componente de entrenamiento,
 * así cada pantalla tiene su reloj y muere con ella. Se apaga en `stop()`, al
 * agotarse y en `ngOnDestroy`; una vez destruido ya no arranca, para que el
 * cierre tardío de un modal no deje un intervalo contando para una pantalla
 * que ya no existe.
 */
@Injectable()
export class TrainingTimerService implements OnDestroy {
  private readonly timeLeftSubject = new BehaviorSubject<number>(0);
  private readonly timeUpSubject = new Subject<void>();
  /**
   * Suscripción viva del reloj. Es una sola referencia (y no un Subject de
   * cancelación) a propósito: apagarla es la única forma de garantizar que no
   * queden dos cuentas atrás restando a la vez.
   */
  private ticks: Subscription | null = null;
  private destroyed = false;

  /** Segundos restantes del bloque; emite el valor actual al suscribirse y en cada tic. */
  readonly timeLeft$: Observable<number> = this.timeLeftSubject.asObservable();

  /** El bloque se agotó. Emite una vez por cuenta atrás, con el reloj ya apagado. */
  readonly timeUp$: Observable<void> = this.timeUpSubject.asObservable();

  /** Segundos restantes del bloque, legibles en el acto. */
  get timeLeft(): number {
    return this.timeLeftSubject.value;
  }

  /**
   * Existe para montar un estado concreto (pruebas) y para dejar el restante a
   * cero al cerrar la sesión; el flujo normal lo mueven `start` y los tics. No
   * arranca ni apaga el reloj.
   */
  set timeLeft(seconds: number) {
    this.timeLeftSubject.next(seconds);
  }

  /** Hay un reloj contando ahora mismo. */
  get isRunning(): boolean {
    return this.ticks !== null;
  }

  /**
   * Arranca la cuenta atrás desde `seconds`, apagando antes cualquier reloj
   * anterior. Un tiempo de 0 (o negativo) deja el restante en 0 y no arranca
   * nada: un bloque sin tiempo no tiene nada que contar ni que vencer.
   */
  start(seconds: number): void {
    if (this.destroyed) {
      return;
    }

    this.stop();
    this.timeLeftSubject.next(Math.max(seconds, 0));

    if (this.timeLeft === 0) {
      return;
    }

    this.ticks = interval(1000).subscribe(() => this.tick());
  }

  /** Congela el restante: apaga el reloj y conserva los segundos que quedaban. */
  pause(): void {
    this.stop();
  }

  /**
   * Sigue desde el restante congelado. Sin tiempo restante no hay nada que
   * reanudar: arrancar aquí creaba un reloj que vencía al primer segundo y
   * forzaba un cambio de bloque.
   */
  resume(): void {
    if (this.timeLeft <= 0) {
      return;
    }
    this.start(this.timeLeft);
  }

  /** Apaga el reloj sin tocar el restante. Repetirlo no hace nada. */
  stop(): void {
    this.ticks?.unsubscribe();
    this.ticks = null;
  }

  ngOnDestroy(): void {
    this.stop();
    this.destroyed = true;
    this.timeUpSubject.complete();
    this.timeLeftSubject.complete();
  }

  private tick(): void {
    if (this.timeLeft > 0) {
      this.timeLeftSubject.next(this.timeLeft - 1);
      return;
    }

    // Se apaga antes de avisar: así quien escuche puede arrancar otra cuenta
    // atrás en el acto sin que este tic la mate, y aunque nadie escuche no
    // queda ningún intervalo vivo.
    this.stop();
    this.timeUpSubject.next();
  }
}
