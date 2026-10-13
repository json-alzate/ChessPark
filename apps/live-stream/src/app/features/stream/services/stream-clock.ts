import { InjectionToken } from '@angular/core';

/** El reloj del director: se sustituye en las pruebas para no esperar de verdad. */
export interface StreamClock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export const STREAM_CLOCK = new InjectionToken<StreamClock>('STREAM_CLOCK', {
  providedIn: 'root',
  factory: () => ({
    now: () => Date.now(),
    sleep: (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  }),
});
