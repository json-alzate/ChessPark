/**
 * Marcapasos de frames: convierte los frames que entrega Chrome (en el momento que el navegador quiere) en una
 * secuencia de cadencia EXACTA para ffmpeg: un frame cada 1/fps de segundo.
 *
 * Por qué hace falta: Chrome entrega los frames con un ritmo muy parejo, pero si se los pasamos a ffmpeg con
 * `-use_wallclock_as_timestamps`, ffmpeg les pone la hora a la que los LEE del tubo, y esa lectura sale en ráfagas:
 * un movimiento uniforme se ve a tirones (frames que no avanzan seguidos de otros que avanzan el doble).
 *
 * Aquí el tiempo es el nuestro: el frame n se escribe a la hora ideal origen + n/fps (con un pequeño retardo para
 * que ya haya llegado el frame más cercano), y se escoge el frame de Chrome que llegó más cerca de esa hora. Si la
 * página está quieta y Chrome no manda nada, se repite el último, que es lo correcto.
 */
export class FramePacer {
  /**
   * @param {object} opts
   * @param {number} [opts.fps=30]      cadencia de salida
   * @param {number} [opts.delayMs=24]  retardo de reproducción: se espera este tiempo antes de escribir cada frame
   * @param {number} [opts.keep=16]     cuántos frames recientes se conservan para elegir
   */
  constructor({ fps = 30, delayMs = 24, keep = 16 } = {}) {
    this.interval = 1000 / fps;
    this.delayMs = delayMs;
    this.keep = keep;
    this.frames = [];       // { data, at } ordenados por llegada
    this.origin = null;     // ms: instante ideal del frame 0
    this.emitted = 0;
  }

  /** Guarda un frame que acaba de llegar de Chrome. */
  push(data, atMs) {
    this.frames.push({ data, at: atMs });
    if (this.frames.length > this.keep) this.frames.shift();
  }

  /** Fija el origen: el frame 0 corresponde a `nowMs`. */
  begin(nowMs) {
    this.origin = nowMs;
    this.emitted = 0;
  }

  /** El frame que mejor representa el instante `idealMs`, o null si todavía no llegó ninguno. */
  pick(idealMs) {
    if (this.frames.length === 0) return null;
    let best = this.frames[0];
    for (const f of this.frames) {
      if (Math.abs(f.at - idealMs) < Math.abs(best.at - idealMs)) best = f;
    }
    // Página quieta: Chrome no manda frames. Si el más cercano está lejos, vale el más reciente anterior.
    if (Math.abs(best.at - idealMs) > this.interval) {
      const before = this.frames.filter((f) => f.at <= idealMs);
      if (before.length > 0) best = before[before.length - 1];
    }
    return best.data;
  }

  /**
   * Escribe todos los frames que ya tocan hasta `nowMs` (más de uno si el reloj se retrasó, para no perder la
   * cadencia). Devuelve cuántos escribió. `write(data)` puede devolver false para indicar que se descartó.
   */
  drain(nowMs, write) {
    let count = 0;
    while (this.origin !== null && this.origin + this.emitted * this.interval + this.delayMs <= nowMs) {
      const data = this.pick(this.origin + this.emitted * this.interval);
      if (data === null) break;
      write(data);
      this.emitted++;
      count++;
    }
    return count;
  }
}
