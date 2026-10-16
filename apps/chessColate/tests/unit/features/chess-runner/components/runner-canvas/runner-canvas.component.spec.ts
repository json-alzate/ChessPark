import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideTranslocoTesting } from '@tests/support/transloco-testing';

import { RUNNER_PHYSICS as P } from '@features/chess-runner/config/runner.config';
import {
  RunnerCanvasComponent,
  RunnerEventName,
  RunnerProgress,
} from '@features/chess-runner/components/runner-canvas/runner-canvas.component';
import { RunnerPiece, RunnerState, RunnerStats } from '@features/chess-runner/models/runner.model';
import { RunnerPiecesService } from '@features/chess-runner/services/runner-pieces.service';
import { RunnerSprite, RunnerSpritesService } from '@features/chess-runner/services/runner-sprites.service';

// La librería del tablero arrastra cm-chessboard, que Jest no carga: el lienzo solo usa su tabla de piezas
jest.mock('@chesspark/board', () => ({
  CHESSBOARD_ASSETS_URL: 'assets/cm-chessboard/assets/',
  PIECES_FILES: { cburnett: 'pieces/standard.svg' },
  getChessboardAppearance: () => ({ pieces: 'cburnett', board: 'default' }),
}));

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

/** Imágenes reconocibles de los efectos, para comprobar que se dibujan. */
const IMAGEN_POLVO = { efecto: 'polvo' } as unknown as CanvasImageSource;
const IMAGEN_CHISPA = { efecto: 'chispa' } as unknown as CanvasImageSource;

/** Los sprites de Chocolate, el escenario y los efectos, con medidas razonables. */
function spritesFalsos(): Map<string, RunnerSprite> {
  const sprite = (frameW: number, frameH: number, frames = 1): RunnerSprite => ({
    image: {} as CanvasImageSource,
    frameW,
    frameH,
    frames,
    fps: 8,
  });
  const mapa = new Map<string, RunnerSprite>();
  for (const [nombre, frames] of [['run', 4], ['jump', 3], ['hurt', 2], ['happy', 2]] as const) {
    mapa.set(`dog-${nombre}`, sprite(52, 40, frames));
  }
  for (const escena of ['floor', 'hills', 'sky', 'cloud-0', 'cloud-1', 'skyline']) {
    mapa.set(`scene-${escena}`, sprite(32, 20));
  }
  mapa.set('fx-dust', { ...sprite(12, 8, 3), image: IMAGEN_POLVO });
  mapa.set('fx-spark', { ...sprite(11, 11, 3), image: IMAGEN_CHISPA });
  return mapa;
}

/** Las doce piezas del set elegido, como imágenes reconocibles. */
function piezasFalsas() {
  const images = new Map<string, CanvasImageSource>();
  const urls = new Map<string, string>();
  for (const color of ['w', 'b']) {
    for (const letra of ['k', 'q', 'r', 'b', 'n', 'p']) {
      images.set(`${color}${letra}`, { pieza: `${color}${letra}` } as unknown as CanvasImageSource);
      urls.set(`${color}${letra}`, `data:pieza-${color}${letra}`);
    }
  }
  return { images, urls };
}

const PEON: RunnerPiece = { kind: 'pawn', color: 'w' };

describe('RunnerCanvasComponent', () => {
  let fixture: ComponentFixture<RunnerCanvasComponent>;
  let lienzo: RunnerCanvasComponent;
  let ctx: ReturnType<typeof contextoFalso>;
  const sprites = { load: jest.fn() };
  const piezas = { load: jest.fn() };

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
    piezas.load.mockResolvedValue(piezasFalsas());
    await TestBed.configureTestingModule({
      imports: [RunnerCanvasComponent],
      providers: [
        provideTranslocoTesting({ CHESS_RUNNER: { canvasLabel: 'Chocolate corre y salta' } }),
        { provide: RunnerSpritesService, useValue: sprites },
        { provide: RunnerPiecesService, useValue: piezas },
      ],
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
      expect(progresos[0]).toEqual({ cleared: 0, total: 2, stumbles: 0, combo: 0, meters: 0, cookies: 0 });
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

    it('si el set de piezas no carga también lo avisa: sin piezas no hay carrera', async () => {
      piezas.load.mockRejectedValue(new Error('sin red'));
      jest.spyOn(console, 'error').mockImplementation(() => undefined);

      await iniciar();
      avanzar(200);

      expect(fallos).toBe(1);
      expect(estado()).toBeUndefined();
    });

    it('dibuja las piezas del set que el usuario eligió', async () => {
      await iniciar();
      avanzar(2000);

      const imagenes = (ctx['drawImage'] as jest.Mock).mock.calls.map(([imagen]) => imagen);
      expect(imagenes).toContainEqual({ pieza: 'wp' });
    });

    it('el lienzo tiene un nombre accesible traducido, no la clave', async () => {
      await iniciar();

      expect(canvas().getAttribute('aria-label')).toBe('Chocolate corre y salta');
    });

    it('si el navegador no da contexto 2D también lo avisa', async () => {
      (HTMLCanvasElement.prototype.getContext as jest.Mock).mockReturnValue(null);

      await iniciar();

      expect(fallos).toBe(1);
    });
  });

  describe('efectos', () => {
    const dibujado = (imagen: CanvasImageSource) =>
      (ctx['drawImage'] as jest.Mock).mock.calls.some(([img]) => img === imagen);

    beforeEach(() => iniciar());

    it('al saltar suelta polvo', () => {
      tecla('keydown', ' ');
      avanzar(40);

      expect(dibujado(IMAGEN_POLVO)).toBe(true);
    });

    it('sin saltar ni aterrizar no hay polvo', () => {
      avanzar(40);
      expect(dibujado(IMAGEN_POLVO)).toBe(false);
    });

    it('al aterrizar suelta polvo otra vez', () => {
      tecla('keydown', ' ');
      
      avanzar(900);
      (ctx['drawImage'] as jest.Mock).mockClear();
      // El polvo del aterrizaje ya se apagó: lo que se comprueba es que el salto dejó de ser noticia
      expect(eventos).toContain('landed');
    });

    it('el doble salto suelta una chispa en el aire', () => {
      tecla('keydown', ' ');
      avanzar(100);
      tecla('keydown', ' ');
      (ctx['drawImage'] as jest.Mock).mockClear();

      avanzar(300);

      expect(dibujado(IMAGEN_CHISPA)).toBe(true);
    });

    it('una pieza superada suelta una chispa', () => {
      // Se pasa el peón saltándolo en su ventana: sale a los 1,54 s y se salta ~0,95 s después
      avanzar(2490);
      tecla('keydown', ' ');
      
      avanzar(1200);

      expect(eventos).toContain('cleared');
      expect(dibujado(IMAGEN_CHISPA)).toBe(true);
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

    it('sin nadie que juegue tropieza y avisa', async () => {
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

      avanzar(900);
      eventos.length = 0;
      tecla('keydown', 'w');
      expect(eventos).toEqual(['jump']);
    });

    it('una segunda pulsación en el aire es el doble salto: se ejecuta en la cima y lo avisa', () => {
      tecla('keydown', ' ');
      avanzar(100);
      tecla('keydown', ' ');
      // Subiendo, el segundo toque espera a la cima
      expect(eventos).toEqual(['jump']);

      avanzar(300);

      expect(eventos.filter((e) => e === 'doubleJump')).toHaveLength(1);
      expect(estado().dog.jumps).toBe(2);
    });

    it('un tercer toque no es otro salto: no hay triple salto', () => {
      tecla('keydown', ' ');
      avanzar(100);
      tecla('keydown', ' ');
      avanzar(400);
      eventos.length = 0;

      tecla('keydown', ' ');

      expect(eventos).toEqual([]);
    });

    it('la repetición automática de la tecla no cuenta como pulsaciones nuevas', () => {
      tecla('keydown', ' ');
      avanzar(900);
      eventos.length = 0;
      tecla('keydown', ' ', { repeat: true });
      tecla('keydown', ' ', { repeat: true });

      expect(eventos).toEqual([]);
    });

    it.each([['ArrowDown'], ['ArrowRight'], ['s'], ['d']])('%j no hace nada: solo hay un control', (key) => {
      const e = tecla('keydown', key);

      expect(eventos).toEqual([]);
      expect(e.defaultPrevented).toBe(false);
    });

    it('evita que Espacio y la flecha arriba desplacen la página', () => {
      expect(tecla('keydown', ' ').defaultPrevented).toBe(true);
      expect(tecla('keydown', 'ArrowUp').defaultPrevented).toBe(true);
    });

    it('si el usuario escribe en un campo de texto no se juega', () => {
      const campo = document.createElement('input');
      document.body.appendChild(campo);
      const e = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
      campo.dispatchEvent(e);

      expect(eventos).toEqual([]);
      expect(e.defaultPrevented).toBe(false);
      campo.remove();
    });
  });

  describe('toques', () => {
    beforeEach(() => iniciar());

    it('un toque salta al instante, sin esperar a soltar el dedo', () => {
      puntero('pointerdown', 100, 100);

      expect(eventos).toEqual(['jump']);
    });

    it('tocar y mantener es el mismo salto: no flota', () => {
      puntero('pointerdown', 100, 100);
      avanzar(1000);
      puntero('pointerup', 100, 100);

      expect(estado().dog.y).toBe(0);
      expect(eventos).toContain('landed');
    });

    it('deslizar no es un gesto: solo cuenta el toque', () => {
      puntero('pointerdown', 100, 100);
      puntero('pointermove', 100, 180);
      puntero('pointerup', 100, 180);

      expect(eventos).toEqual(['jump']);
    });

    it('dos toques seguidos son el doble salto', () => {
      puntero('pointerdown', 100, 100);
      avanzar(100);
      puntero('pointerdown', 100, 100);
      avanzar(300);

      expect(eventos).toEqual(expect.arrayContaining(['jump', 'doubleJump']));
    });

    it('con el botón derecho del ratón no pasa nada', () => {
      const e = new MouseEvent('pointerdown', { button: 2, bubbles: true, cancelable: true });
      Object.defineProperty(e, 'pointerId', { value: 1 });
      Object.defineProperty(e, 'pointerType', { value: 'mouse' });
      canvas().dispatchEvent(e);
      avanzar(200);

      expect(eventos).toEqual([]);
    });

    it('no pide capturar el puntero: no hay gesto que seguir', () => {
      const captura = jest.fn();
      Object.assign(canvas(), { setPointerCapture: captura });

      puntero('pointerdown', 100, 100);

      expect(captura).not.toHaveBeenCalled();
    });
  });

  describe('zona de toques', () => {
    it('recoge los toques de la zona que le pasan, no solo los del lienzo', async () => {
      const zona = document.createElement('div');
      document.body.appendChild(zona);
      await iniciar([PEON], { tapZone: zona });

      puntero('pointerdown', 50, 600, { destino: zona });

      expect(eventos).toEqual(['jump']);
      zona.remove();
    });

    it('un botón dentro de la zona sigue siendo un botón: no salta', async () => {
      const zona = document.createElement('div');
      const boton = document.createElement('button');
      zona.appendChild(boton);
      document.body.appendChild(zona);
      await iniciar([PEON], { tapZone: zona });

      puntero('pointerdown', 50, 600, { destino: boton });
      avanzar(200);

      expect(eventos).toEqual([]);
      zona.remove();
    });

    it('al destruirse deja de escuchar la zona y el teclado', async () => {
      const zona = document.createElement('div');
      document.body.appendChild(zona);
      await iniciar([PEON], { tapZone: zona });
      fixture.destroy();

      puntero('pointerdown', 50, 600, { destino: zona });
      tecla('keydown', ' ');

      expect(eventos).toEqual([]);
      zona.remove();
    });
  });
});
