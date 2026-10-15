import { ComponentFixture, TestBed } from '@angular/core/testing';

import {
  GESTURE_DECISION_MS,
  GESTURE_MAX_WAIT_MS,
  RUNNER_PHYSICS as P,
} from '@features/chess-runner/config/runner.config';
import {
  RunnerCanvasComponent,
  RunnerEventName,
  RunnerProgress,
} from '@features/chess-runner/components/runner-canvas/runner-canvas.component';
import { RunnerPiece, RunnerState, RunnerStats } from '@features/chess-runner/models/runner.model';
import { RunnerSprite, RunnerSpritesService } from '@features/chess-runner/services/runner-sprites.service';

/**
 * El lienzo del runner: el bucle, los gestos y las teclas. El canvas y los sprites son dobles (jsdom no
 * dibuja) y el reloj es el de Jest, así que se puede avanzar la carrera a mano.
 */

type Interno = { state: RunnerState };

/** Contexto 2D falso: acepta cualquier llamada de dibujo y se puede inspeccionar. */
function contextoFalso() {
  return new Proxy(
    { setTransform: jest.fn(), drawImage: jest.fn(), fillRect: jest.fn(), clearRect: jest.fn(), strokeRect: jest.fn() } as Record<string, unknown>,
    {
      get: (target, prop: string) => (prop in target ? target[prop] : jest.fn()),
      set: (target, prop: string, value) => {
        target[prop] = value;
        return true;
      },
    }
  );
}

/** Todos los sprites que dibuja el renderizador, con medidas razonables. */
function spritesFalsos(): Map<string, RunnerSprite> {
  const sprite = (frameW: number, frameH: number, frames = 1): RunnerSprite => ({
    image: {} as CanvasImageSource,
    frameW,
    frameH,
    frames,
    fps: 8,
  });
  const mapa = new Map<string, RunnerSprite>();
  for (const [nombre, frames] of [['run', 4], ['jump', 3], ['slide', 2], ['hurt', 2], ['happy', 2]] as const) {
    mapa.set(`dog-${nombre}`, sprite(52, 40, frames));
  }
  for (const kind of ['pawn', 'rook', 'bishop', 'knight', 'queen', 'king']) {
    for (const color of ['w', 'b']) {
      mapa.set(`piece-${kind}-${color}`, sprite(20, 30));
    }
  }
  for (const hint of ['jump', 'slide', 'long', 'hold', 'double', 'precise']) {
    mapa.set(`hint-${hint}`, sprite(13, 13));
  }
  for (const escena of ['floor', 'hills', 'sky', 'cloud-0', 'cloud-1']) {
    mapa.set(`scene-${escena}`, sprite(32, 20));
  }
  return mapa;
}

const PEON: RunnerPiece = { kind: 'pawn', color: 'w' };

describe('RunnerCanvasComponent', () => {
  let fixture: ComponentFixture<RunnerCanvasComponent>;
  let lienzo: RunnerCanvasComponent;
  let ctx: ReturnType<typeof contextoFalso>;
  const sprites = { load: jest.fn() };

  const eventos: RunnerEventName[] = [];
  const progresos: RunnerProgress[] = [];
  const terminadas: RunnerStats[] = [];
  let fallos = 0;

  const estado = () => (lienzo as unknown as Interno).state;
  const elemento = () => fixture.nativeElement as HTMLElement;
  const canvas = () => elemento().querySelector('canvas') as HTMLCanvasElement;

  async function iniciar(
    secuencia: RunnerPiece[] = [PEON],
    extra: Partial<RunnerCanvasComponent> = {}
  ) {
    fixture = TestBed.createComponent(RunnerCanvasComponent);
    lienzo = fixture.componentInstance;
    lienzo.sequence = secuencia;
    Object.assign(lienzo, extra);
    // jsdom no maqueta: el ancho disponible se fija a mano
    Object.defineProperty(elemento(), 'clientWidth', { value: 393, configurable: true });
    lienzo.runnerEvent.subscribe((e) => eventos.push(e));
    lienzo.progress.subscribe((p) => progresos.push(p));
    lienzo.finished.subscribe((s) => terminadas.push(s));
    lienzo.failed.subscribe(() => fallos++);
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
  }

  /** Avanza el reloj de Jest, que mueve el `requestAnimationFrame`. */
  const avanzar = (ms: number) => jest.advanceTimersByTime(ms);

  function puntero(tipo: string, x: number, y: number, extra: { boton?: number; destino?: Element } = {}) {
    const e = new MouseEvent(tipo, { clientX: x, clientY: y, button: extra.boton ?? 0, bubbles: true, cancelable: true });
    Object.defineProperty(e, 'pointerId', { value: 1 });
    Object.defineProperty(e, 'pointerType', { value: 'touch' });
    (extra.destino ?? canvas()).dispatchEvent(e);
    return e;
  }

  function tecla(tipo: 'keydown' | 'keyup', key: string, extra: KeyboardEventInit = {}) {
    const e = new KeyboardEvent(tipo, { key, bubbles: true, cancelable: true, ...extra });
    window.dispatchEvent(e);
    return e;
  }

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    eventos.length = 0;
    progresos.length = 0;
    terminadas.length = 0;
    fallos = 0;
    ctx = contextoFalso();
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    sprites.load.mockResolvedValue(spritesFalsos());
    await TestBed.configureTestingModule({
      imports: [RunnerCanvasComponent],
      providers: [{ provide: RunnerSpritesService, useValue: sprites }],
    }).compileComponents();
  });

  afterEach(() => {
    fixture?.destroy();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe('arranque', () => {
    it('crea la carrera con las piezas recibidas y avisa del avance inicial', async () => {
      await iniciar([PEON, { kind: 'rook', color: 'b' }]);

      expect(estado().total).toBe(2);
      expect(progresos[0]).toEqual({ cleared: 0, total: 2, stumbles: 0 });
    });

    it('dibuja en el lienzo', async () => {
      await iniciar();
      avanzar(40);

      expect((ctx['drawImage'] as jest.Mock).mock.calls.length).toBeGreaterThan(0);
    });

    it('ajusta el lienzo a una escala entera: a 393 px se pinta a 2× con 196 px lógicos', async () => {
      await iniciar();

      expect(canvas().style.width).toBe('392px');
      expect(canvas().style.height).toBe('352px');
      expect(estado().width).toBe(196);
    });

    it('en una pantalla ancha se limita al ancho máximo', async () => {
      fixture = TestBed.createComponent(RunnerCanvasComponent);
      lienzo = fixture.componentInstance;
      lienzo.sequence = [PEON];
      lienzo.maxWidth = 640;
      Object.defineProperty(elemento(), 'clientWidth', { value: 1400, configurable: true });
      fixture.detectChanges();
      await Promise.resolve();
      await Promise.resolve();

      expect(canvas().style.width).toBe('639px');
    });

    it('si los sprites no cargan lo avisa y no arranca ningún bucle', async () => {
      sprites.load.mockRejectedValue(new Error('sin red'));
      jest.spyOn(console, 'error').mockImplementation(() => undefined);

      await iniciar();
      avanzar(200);

      expect(fallos).toBe(1);
      expect(estado()).toBeUndefined();
    });

    it('si el navegador no da contexto 2D también lo avisa', async () => {
      (HTMLCanvasElement.prototype.getContext as jest.Mock).mockReturnValue(null);

      await iniciar();

      expect(fallos).toBe(1);
    });
  });

  describe('el bucle', () => {
    it('avanza la carrera con el reloj', async () => {
      await iniciar();
      const antes = estado().time;

      avanzar(500);

      expect(estado().time).toBeGreaterThan(antes + 0.3);
    });

    it('con un paso fijo: lo que avanza no depende del ritmo de los fotogramas', async () => {
      await iniciar();
      avanzar(1000);
      const unSegundo = estado().distance;

      expect(unSegundo).toBeGreaterThan(P.speed * 0.9);
      expect(unSegundo).toBeLessThan(P.speed * 1.1);
    });

    it('una carrera que se pierde un tirón (pestaña dormida) no se pone al día de golpe', async () => {
      await iniciar();
      // Un fotograma que llega 10 s tarde: solo se simula una fracción
      jest.setSystemTime(Date.now() + 10_000);
      avanzar(20);

      expect(estado().time).toBeLessThan(1);
    });

    it('sin nadie que juegue tropieza, avisa, y la pieza vuelve a salir', async () => {
      await iniciar();
      avanzar(3500);

      expect(eventos).toContain('stumble');
      expect(estado().stumbles).toBeGreaterThan(0);
      expect(progresos.some((p) => p.stumbles > 0)).toBe(true);
    });

    it('al terminar avisa del tramo final, y después entrega las estadísticas una sola vez', async () => {
      await iniciar();
      avanzar(15_000);

      expect(eventos.filter((e) => e === 'finishing')).toHaveLength(1);
      expect(terminadas).toHaveLength(1);
      expect(terminadas[0]).toMatchObject({ total: 1, clean: false });
      expect(terminadas[0].stumbles).toBeGreaterThan(0);
    });

    it('una carrera sin obstáculos termina enseguida y sin tropiezos', async () => {
      await iniciar([]);
      avanzar(4000);

      expect(terminadas).toHaveLength(1);
      expect(terminadas[0]).toMatchObject({ total: 0, clean: true, stumbles: 0 });
    });

    it('una vez terminada deja de pedir fotogramas', async () => {
      await iniciar([]);
      avanzar(6000);
      const rAF = jest.spyOn(window, 'requestAnimationFrame');

      avanzar(2000);

      expect(rAF).not.toHaveBeenCalled();
    });

    it('al destruirse detiene el bucle y no sigue emitiendo', async () => {
      await iniciar();
      avanzar(100);
      fixture.destroy();
      const antes = eventos.length;

      avanzar(10_000);

      expect(eventos.length).toBe(antes);
      expect(terminadas).toHaveLength(0);
    });
  });

  describe('teclado', () => {
    beforeEach(() => iniciar());

    it('Espacio salta y lo avisa', () => {
      tecla('keydown', ' ');

      expect(eventos).toEqual(['jump']);
      expect(estado().dog.vy).toBe(P.jumpVelocity);
    });

    it('la flecha hacia arriba y W también', () => {
      tecla('keydown', 'ArrowUp');
      expect(eventos).toEqual(['jump']);
    });

    it('una segunda pulsación en el aire es el doble salto', () => {
      tecla('keydown', ' ');
      tecla('keyup', ' ');
      avanzar(100);
      tecla('keydown', ' ');

      expect(eventos).toEqual(['jump', 'doubleJump']);
    });

    it('la repetición automática de la tecla no cuenta como pulsaciones nuevas', () => {
      tecla('keydown', ' ');
      tecla('keydown', ' ', { repeat: true });
      tecla('keydown', ' ', { repeat: true });

      expect(eventos).toEqual(['jump']);
    });

    it('la flecha hacia abajo agacha', () => {
      tecla('keydown', 'ArrowDown');
      expect(estado().dog.slide).toBe(P.slideTime);
    });

    it('la flecha a la derecha hace el salto largo', () => {
      tecla('keydown', 'ArrowRight');

      expect(estado().dog.longJump).toBe(true);
      expect(eventos).toEqual(['jump']);
    });

    it('mantener Espacio suspende a Chocolate en la cima; soltarlo, no', () => {
      tecla('keydown', ' ');
      avanzar(330);
      const altura = estado().dog.y;
      avanzar(150);
      // Con la tecla pulsada sigue arriba tras el momento en que caería
      expect(estado().dog.y).toBeGreaterThan(altura - 4);

      tecla('keyup', ' ');
      avanzar(300);
      expect(estado().dog.y).toBeLessThan(altura - 20);
    });

    it('evita que Espacio y las flechas desplacen la página', () => {
      expect(tecla('keydown', ' ').defaultPrevented).toBe(true);
      expect(tecla('keydown', 'ArrowDown').defaultPrevented).toBe(true);
    });

    it('otras teclas no hacen nada y no se bloquean', () => {
      const e = tecla('keydown', 'a');

      expect(e.defaultPrevented).toBe(false);
      expect(eventos).toEqual([]);
    });

    it('si el usuario escribe en un campo de texto no se juega', () => {
      const entrada = document.createElement('input');
      document.body.appendChild(entrada);
      const e = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
      entrada.dispatchEvent(e);
      entrada.remove();

      expect(e.defaultPrevented).toBe(false);
      expect(eventos).toEqual([]);
    });
  });

  describe('gestos', () => {
    beforeEach(() => iniciar());

    it('un toque rápido es un salto', () => {
      puntero('pointerdown', 100, 100);
      puntero('pointerup', 100, 100);

      expect(eventos).toEqual(['jump']);
    });

    it('un toque rápido no flota: aterriza en lo que dura un salto normal', () => {
      puntero('pointerdown', 100, 100);
      puntero('pointerup', 100, 100);

      avanzar(800);

      expect(estado().dog.y).toBe(0);
      expect(eventos).toContain('landed');
    });

    it('mantener pulsado más allá del instante de decisión salta y hace flotar', () => {
      puntero('pointerdown', 100, 100);
      avanzar(GESTURE_DECISION_MS + 10);
      expect(eventos).toEqual(['jump']);

      // Con el dedo puesto, a los 0,8 s un salto normal ya habría aterrizado: este sigue en el aire
      avanzar(800);
      expect(estado().dog.y).toBeGreaterThan(0);

      puntero('pointerup', 100, 100);
    });

    it('soltar tras mantener termina el flotar y Chocolate aterriza', () => {
      puntero('pointerdown', 100, 100);
      avanzar(GESTURE_DECISION_MS + 10 + 400);
      puntero('pointerup', 100, 100);

      avanzar(600);

      expect(estado().dog.y).toBe(0);
    });

    it('deslizar hacia abajo agacha, sin saltar antes', () => {
      puntero('pointerdown', 100, 100);
      puntero('pointermove', 100, 120);

      expect(estado().dog.slide).toBe(P.slideTime);
      expect(eventos).toEqual([]);
      puntero('pointerup', 100, 120);
      expect(eventos).toEqual([]);
    });

    it('deslizar hacia arriba y a la derecha es el salto largo', () => {
      puntero('pointerdown', 100, 100);
      puntero('pointermove', 125, 80);

      expect(estado().dog.longJump).toBe(true);
    });

    it('un deslizamiento lento, que tarda más que el instante de decisión, sigue siendo un deslizamiento', () => {
      puntero('pointerdown', 100, 100);
      puntero('pointermove', 100, 108); // ya se mueve (más del margen) pero aún no llega al umbral
      avanzar(GESTURE_DECISION_MS + 15);
      expect(eventos).toEqual([]); // no lo da por un toque

      puntero('pointermove', 100, 122);

      expect(estado().dog.slide).toBe(P.slideTime);
      expect(eventos).toEqual([]);
    });

    it('si el dedo se mueve pero nunca llega a deslizar, acaba siendo un toque (con un tope de espera)', () => {
      puntero('pointerdown', 100, 100);
      puntero('pointermove', 106, 102);

      avanzar(GESTURE_MAX_WAIT_MS + 40);

      expect(eventos).toEqual(['jump']);
    });

    it('un dedo que tiembla un poco cuenta como quieto', () => {
      puntero('pointerdown', 100, 100);
      puntero('pointermove', 102, 101);
      avanzar(GESTURE_DECISION_MS + 5);

      expect(eventos).toEqual(['jump']);
    });

    it('un gesto ya decidido no se vuelve a decidir al seguir moviendo', () => {
      puntero('pointerdown', 100, 100);
      puntero('pointermove', 100, 125);
      puntero('pointermove', 100, 160);
      puntero('pointermove', 140, 100);

      expect(estado().dog.slide).toBe(P.slideTime);
      expect(estado().dog.longJump).toBe(false);
    });

    it('con el botón derecho del ratón no pasa nada', () => {
      const e = new MouseEvent('pointerdown', { button: 2, bubbles: true, cancelable: true });
      Object.defineProperty(e, 'pointerId', { value: 1 });
      Object.defineProperty(e, 'pointerType', { value: 'mouse' });
      canvas().dispatchEvent(e);
      puntero('pointerup', 0, 0);
      avanzar(200);

      expect(eventos).toEqual([]);
    });

    it('cancelar el gesto no deja un temporizador vivo que salte después', () => {
      puntero('pointerdown', 100, 100);
      puntero('pointercancel', 100, 100);
      avanzar(300);

      expect(eventos.filter((e) => e === 'jump').length).toBeLessThanOrEqual(1);
    });
  });

  describe('zona de gestos', () => {
    it('recoge los toques de la zona que le pasan, no solo los del lienzo', async () => {
      const zona = document.createElement('div');
      document.body.appendChild(zona);
      await iniciar([PEON], { gestureZone: zona });

      puntero('pointerdown', 50, 600, { destino: zona });
      puntero('pointerup', 50, 600, { destino: zona });

      expect(eventos).toEqual(['jump']);
      zona.remove();
    });

    it('un botón dentro de la zona sigue siendo un botón: no salta', async () => {
      const zona = document.createElement('div');
      const boton = document.createElement('button');
      zona.appendChild(boton);
      document.body.appendChild(zona);
      await iniciar([PEON], { gestureZone: zona });

      puntero('pointerdown', 50, 600, { destino: boton });
      puntero('pointerup', 50, 600, { destino: boton });
      avanzar(200);

      expect(eventos).toEqual([]);
      zona.remove();
    });
  });
});
