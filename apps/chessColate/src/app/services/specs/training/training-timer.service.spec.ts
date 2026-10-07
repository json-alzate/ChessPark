import { TrainingTimerService } from '../../training/training-timer.service';

/**
 * Pruebas de la cuenta atrás del bloque en aislamiento: sin pantalla, sin
 * tablero y sin Angular. El reloj se controla con los fake timers de Jest, así
 * que jest.getTimerCount() dice cuántos relojes hay vivos en cada momento.
 */
describe('TrainingTimerService', () => {
  let timer: TrainingTimerService;
  /** Veces que avisó `timeUp$`. */
  let timeUps: number;
  /** Todo lo que publicó `timeLeft$`, en orden. */
  let emitted: number[];

  beforeEach(() => {
    jest.useFakeTimers();
    timer = new TrainingTimerService();
    timeUps = 0;
    emitted = [];
    timer.timeUp$.subscribe(() => timeUps++);
    timer.timeLeft$.subscribe((seconds) => emitted.push(seconds));
  });

  afterEach(() => {
    timer.ngOnDestroy();
    jest.useRealTimers();
  });

  describe('cuenta atrás', () => {
    it('arranca con el tiempo pedido y baja un segundo por tic con un único reloj', () => {
      timer.start(3);

      expect(timer.timeLeft).toBe(3);
      expect(timer.isRunning).toBe(true);
      expect(jest.getTimerCount()).toBe(1);

      jest.advanceTimersByTime(1000);
      expect(timer.timeLeft).toBe(2);
      jest.advanceTimersByTime(2000);
      expect(timer.timeLeft).toBe(0);

      // En 0 el bloque todavía no venció: el reloj sigue vivo un tic más.
      expect(timer.isRunning).toBe(true);
      expect(timeUps).toBe(0);
    });

    it('llegar a 0 no agota el bloque: lo agota el tic siguiente, una sola vez, y deja el reloj apagado', () => {
      timer.start(2);

      jest.advanceTimersByTime(2000);
      expect(timer.timeLeft).toBe(0);
      expect(timeUps).toBe(0);

      jest.advanceTimersByTime(1000);
      expect(timeUps).toBe(1);
      expect(timer.isRunning).toBe(false);
      expect(jest.getTimerCount()).toBe(0);

      // Sin reloj vivo no hay más avisos aunque pase el tiempo.
      jest.advanceTimersByTime(10000);
      expect(timeUps).toBe(1);
      expect(timer.timeLeft).toBe(0);
    });

    it('timeLeft$ publica el valor actual al suscribirse, el de arranque y el de cada tic', () => {
      timer.start(3);
      jest.advanceTimersByTime(3000);

      expect(emitted).toEqual([0, 3, 2, 1, 0]);
    });

    it('sin tiempo (0 o negativo) deja el restante en 0 y no arranca ni vence nada', () => {
      timer.start(0);
      expect(timer.timeLeft).toBe(0);
      expect(timer.isRunning).toBe(false);
      expect(jest.getTimerCount()).toBe(0);

      jest.advanceTimersByTime(5000);
      expect(timeUps).toBe(0);

      timer.start(-5);
      expect(timer.timeLeft).toBe(0);
      expect(jest.getTimerCount()).toBe(0);
    });

    it('arrancar dos veces sin parar deja un solo reloj contando desde el último tiempo', () => {
      timer.start(10);
      jest.advanceTimersByTime(1000);
      expect(timer.timeLeft).toBe(9);

      timer.start(10);
      expect(jest.getTimerCount()).toBe(1);

      // Si el primer reloj siguiera vivo, aquí habría bajado 6 en vez de 3.
      jest.advanceTimersByTime(3000);
      expect(timer.timeLeft).toBe(7);
    });
  });

  describe('pausa, reanudación y parada', () => {
    it('pause congela el restante y resume sigue desde ahí', () => {
      timer.start(10);
      jest.advanceTimersByTime(2000);
      expect(timer.timeLeft).toBe(8);

      timer.pause();
      expect(timer.isRunning).toBe(false);
      expect(jest.getTimerCount()).toBe(0);
      jest.advanceTimersByTime(5000);
      expect(timer.timeLeft).toBe(8);

      timer.resume();
      expect(timer.isRunning).toBe(true);
      expect(jest.getTimerCount()).toBe(1);
      jest.advanceTimersByTime(1000);
      expect(timer.timeLeft).toBe(7);
    });

    it('pausar y reanudar varias veces seguidas mantiene un único reloj', () => {
      timer.start(10);

      timer.pause();
      timer.resume();
      timer.pause();
      timer.resume();
      timer.resume();

      expect(jest.getTimerCount()).toBe(1);
      jest.advanceTimersByTime(3000);
      expect(timer.timeLeft).toBe(7);
    });

    it('resume sin tiempo restante no arranca nada, tampoco después de vencer', () => {
      timer.resume();
      expect(jest.getTimerCount()).toBe(0);

      timer.start(1);
      jest.advanceTimersByTime(2000);
      expect(timeUps).toBe(1);

      timer.resume();
      expect(timer.isRunning).toBe(false);
      expect(jest.getTimerCount()).toBe(0);
      jest.advanceTimersByTime(5000);
      expect(timeUps).toBe(1);
    });

    it('stop apaga el reloj y conserva el restante; repetirlo no hace nada', () => {
      timer.start(5);
      jest.advanceTimersByTime(1000);

      timer.stop();
      timer.stop();

      expect(timer.timeLeft).toBe(4);
      expect(timer.isRunning).toBe(false);
      expect(jest.getTimerCount()).toBe(0);
      jest.advanceTimersByTime(10000);
      expect(timer.timeLeft).toBe(4);
      expect(timeUps).toBe(0);
    });

    it('el setter de timeLeft monta el restante sin arrancar el reloj y lo publica en timeLeft$', () => {
      timer.timeLeft = 42;

      expect(timer.timeLeft).toBe(42);
      expect(emitted[emitted.length - 1]).toBe(42);
      expect(timer.isRunning).toBe(false);
      expect(jest.getTimerCount()).toBe(0);

      // Dejarlo a 0 es lo que hace la pantalla al cerrar la sesión.
      timer.timeLeft = 0;
      timer.resume();
      expect(jest.getTimerCount()).toBe(0);
    });
  });

  describe('aviso de vencimiento', () => {
    it('al avisar el reloj ya está apagado: quien escucha puede arrancar otra cuenta atrás en el acto', () => {
      timer.timeUp$.subscribe(() => timer.start(2));

      timer.start(1);
      jest.advanceTimersByTime(2000);

      expect(timeUps).toBe(1);
      expect(timer.isRunning).toBe(true);
      expect(timer.timeLeft).toBe(2);
      expect(jest.getTimerCount()).toBe(1);

      jest.advanceTimersByTime(1000);
      expect(timer.timeLeft).toBe(1);
      jest.advanceTimersByTime(2000);
      expect(timeUps).toBe(2);
    });

    it('quien escucha puede apagar el reloj dentro del aviso sin que falle ni se repita', () => {
      timer.timeUp$.subscribe(() => timer.stop());

      timer.start(1);
      jest.advanceTimersByTime(2000);

      expect(timeUps).toBe(1);
      expect(jest.getTimerCount()).toBe(0);
      jest.advanceTimersByTime(5000);
      expect(timeUps).toBe(1);
    });
  });

  describe('destrucción', () => {
    it('ngOnDestroy apaga el reloj, cierra los flujos y ya no deja arrancar otro', () => {
      let timeUpCompleted = false;
      let timeLeftCompleted = false;
      timer.timeUp$.subscribe({ complete: () => (timeUpCompleted = true) });
      timer.timeLeft$.subscribe({ complete: () => (timeLeftCompleted = true) });
      timer.start(10);
      expect(jest.getTimerCount()).toBe(1);

      timer.ngOnDestroy();

      expect(jest.getTimerCount()).toBe(0);
      expect(timer.isRunning).toBe(false);
      expect(timeUpCompleted).toBe(true);
      expect(timeLeftCompleted).toBe(true);

      // Un cierre tardío de modal que intente arrancar el reloj de una
      // pantalla ya destruida no deja ningún intervalo vivo.
      timer.start(5);
      expect(timer.isRunning).toBe(false);
      expect(jest.getTimerCount()).toBe(0);
      jest.advanceTimersByTime(10000);
      expect(timeUps).toBe(0);
    });
  });
});
