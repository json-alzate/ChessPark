import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideTranslocoTesting } from '@tests/support/transloco-testing';

import { RunnerLessonComponent } from '@features/chess-runner/components/runner-lesson/runner-lesson.component';
import { lessonDuration, INTRO_SECONDS, MOVE_SECONDS, PAUSE_SECONDS } from '@features/chess-runner/lessons/runner-lesson.util';
import { LESSONS } from '@features/chess-runner/lessons/runner-lessons.data';
import { RunnerPiecesService } from '@features/chess-runner/services/runner-pieces.service';

// La librería del tablero arrastra cm-chessboard, que Jest no carga: el servicio de piezas solo usa su tabla
jest.mock('@chesspark/board', () => ({
  CHESSBOARD_ASSETS_URL: 'assets/cm-chessboard/assets/',
  PIECES_FILES: { cburnett: 'pieces/standard.svg' },
  getChessboardAppearance: () => ({ pieces: 'cburnett', board: 'default' }),
}));

/** Contexto 2D falso que anota lo que se pinta. */
function contextoFalso() {
  const base: Record<string, unknown> = {
    setTransform: jest.fn(),
    drawImage: jest.fn(),
    fillRect: jest.fn(),
    clearRect: jest.fn(),
    arc: jest.fn(),
    stroke: jest.fn(),
    fill: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
  };
  return new Proxy(base, {
    get: (target, prop: string) => (prop in target ? target[prop] : jest.fn()),
    set: (target, prop: string, value) => {
      target[prop] = value;
      return true;
    },
  });
}

function piezasFalsas() {
  const images = new Map<string, CanvasImageSource>();
  for (const color of ['w', 'b']) {
    for (const letra of ['k', 'q', 'r', 'b', 'n', 'p']) {
      images.set(`${color}${letra}`, { pieza: `${color}${letra}` } as unknown as CanvasImageSource);
    }
  }
  return { images, urls: new Map<string, string>() };
}

describe('RunnerLessonComponent', () => {
  let fixture: ComponentFixture<RunnerLessonComponent>;
  let ctx: ReturnType<typeof contextoFalso>;
  const piezas = { load: jest.fn() };
  let terminadas = 0;
  let fallos = 0;

  const canvas = () => fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
  const avanzar = (ms: number) => jest.advanceTimersByTime(ms);
  const dibujadas = () => (ctx['drawImage'] as jest.Mock).mock.calls.map(([imagen]) => imagen);

  async function iniciar(leccion = LESSONS['fork'], ancho = 393) {
    fixture = TestBed.createComponent(RunnerLessonComponent);
    fixture.componentInstance.lesson = leccion;
    fixture.componentInstance.finished.subscribe(() => terminadas++);
    fixture.componentInstance.failed.subscribe(() => fallos++);
    Object.defineProperty(fixture.nativeElement, 'clientWidth', { value: ancho, configurable: true });
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
  }

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    terminadas = 0;
    fallos = 0;
    ctx = contextoFalso();
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    piezas.load.mockResolvedValue(piezasFalsas());
    await TestBed.configureTestingModule({
      imports: [RunnerLessonComponent],
      providers: [
        provideTranslocoTesting({
          CHESS_RUNNER: {
            lessonLabel: 'Un tablero pequeño enseña el patrón',
            lessons: {
              fork: { idea: 'Dos a la vez', see: 'Mira el rey y la torre', play: 'El caballo salta', why: 'Una de las dos cae', tip: 'Busca casillas dobles' },
              skewer: { idea: 'Ensartada', see: 'Rey y torre', play: 'Jaque', play2: 'El rey se aparta', why: 'Cae la de detrás', tip: 'Es una clavada al revés' },
            },
          },
        }),
        { provide: RunnerPiecesService, useValue: piezas },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    fixture?.destroy();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('tiene una etiqueta para quien no ve el lienzo', async () => {
    await iniciar();

    expect(canvas().getAttribute('role')).toBe('img');
    expect(canvas().getAttribute('aria-label')).toBe('Un tablero pequeño enseña el patrón');
  });

  it('el tablero es cuadrado y cabe en la pantalla, con casillas de tamaño entero', async () => {
    await iniciar(LESSONS['fork'], 393);
    // 393 / 8 = 49, pero el tablero no pasa de 320 px: casillas de 40
    expect(canvas().style.width).toBe('320px');
    expect(canvas().style.height).toBe('320px');

    fixture.destroy();
    await iniciar(LESSONS['fork'], 200);
    expect(canvas().style.width).toBe('200px');
  });

  it('dibuja las 64 casillas y las piezas de la posición con el set elegido', async () => {
    await iniciar(LESSONS['fork']);
    avanzar(50);

    const casillas = (ctx['fillRect'] as jest.Mock).mock.calls.filter((c) => c[2] === 40 && c[3] === 40);
    expect(casillas.length).toBeGreaterThanOrEqual(64);
    // Se pinta fotograma a fotograma: se cuentan las piezas distintas que salieron
    expect([...new Set(dibujadas().map((p) => (p as { pieza: string }).pieza))].sort()).toEqual(['bk', 'br', 'wk', 'wn']);
  });

  it('al principio señala lo que hay que mirar con anillos', async () => {
    await iniciar(LESSONS['fork']);
    avanzar(100);

    // Un anillo por casilla señalada: el rey y la torre
    expect((ctx['arc'] as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('la jugada se anima: la pieza se mueve entre un fotograma y otro', async () => {
    await iniciar(LESSONS['fork']);
    const caballo = () => (ctx['drawImage'] as jest.Mock).mock.calls.filter(([i]) => (i as { pieza: string }).pieza === 'wn').map((c) => [c[1], c[2]]);

    avanzar(100);
    const antes = caballo().pop();
    (ctx['drawImage'] as jest.Mock).mockClear();
    avanzar((INTRO_SECONDS + MOVE_SECONDS / 2) * 1000);
    const durante = caballo().pop();
    (ctx['drawImage'] as jest.Mock).mockClear();
    avanzar((MOVE_SECONDS + PAUSE_SECONDS) * 1000);
    const despues = caballo().pop();

    expect(durante).not.toEqual(antes);
    expect(despues).not.toEqual(durante);
  });

  it('al final dibuja las flechas hacia los objetivos', async () => {
    await iniciar(LESSONS['fork']);
    avanzar((lessonDuration(LESSONS['fork']) - 0.3) * 1000);

    expect((ctx['lineTo'] as jest.Mock).mock.calls.length).toBeGreaterThan(0);
    expect((ctx['fill'] as jest.Mock).mock.calls.length).toBeGreaterThan(0);
  });

  it('avisa una sola vez de que terminó, y sigue pintando mientras se espera', async () => {
    await iniciar(LESSONS['fork']);

    avanzar((lessonDuration(LESSONS['fork']) - 0.5) * 1000);
    expect(terminadas).toBe(0);
    avanzar(1500);
    expect(terminadas).toBe(1);

    (ctx['clearRect'] as jest.Mock).mockClear();
    avanzar(2000);
    expect(terminadas).toBe(1);
    expect((ctx['clearRect'] as jest.Mock).mock.calls.length).toBeGreaterThan(0);
  });

  it('si no hay piezas que dibujar avisa con «failed» y no pinta nada', async () => {
    piezas.load.mockRejectedValue(new Error('sin red'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await iniciar();
    avanzar(500);

    expect(fallos).toBe(1);
    expect(terminadas).toBe(0);
    expect(ctx['clearRect']).not.toHaveBeenCalled();
  });

  it('sin contexto de dibujo también avisa de que no puede', async () => {
    (HTMLCanvasElement.prototype.getContext as jest.Mock).mockReturnValue(null);

    await iniciar();

    expect(fallos).toBe(1);
  });

  it('al destruirse deja de pintar y no avisa', async () => {
    await iniciar(LESSONS['fork']);
    avanzar(200);
    fixture.destroy();
    (ctx['clearRect'] as jest.Mock).mockClear();

    avanzar(20_000);

    expect(ctx['clearRect']).not.toHaveBeenCalled();
    expect(terminadas).toBe(0);
  });

  it('dibuja bien la lección de tres jugadas, con la pieza comida desvaneciéndose', async () => {
    await iniciar(LESSONS['skewer']);

    avanzar((lessonDuration(LESSONS['skewer']) + 0.5) * 1000);

    expect(terminadas).toBe(1);
  });

  describe('las frases', () => {
    const idea = () => fixture.nativeElement.querySelector('[data-testid=lesson-idea]').textContent.trim();
    const frase = () => fixture.nativeElement.querySelector('[data-testid=lesson-caption]').textContent.trim();
    const hasta = (segundos: number) => {
      avanzar(segundos * 1000);
      fixture.detectChanges();
    };

    it('arriba, la idea del patrón, que no cambia; debajo, la frase del momento', async () => {
      await iniciar(LESSONS['fork']);
      hasta(0.3);

      expect(idea()).toBe('Dos a la vez');
      expect(frase()).toBe('Mira el rey y la torre');
    });

    it('la frase sigue a la lección: qué mirar, qué se juega, por qué y, al acabar, cómo reconocerlo', async () => {
      await iniciar(LESSONS['fork']);
      hasta(0.3);
      expect(frase()).toBe('Mira el rey y la torre');

      hasta(INTRO_SECONDS + 0.1);
      expect(frase()).toBe('El caballo salta');

      hasta(MOVE_SECONDS + PAUSE_SECONDS);
      expect(frase()).toBe('Una de las dos cae');

      hasta(lessonDuration(LESSONS['fork']));
      expect(frase()).toBe('Busca casillas dobles');
      expect(idea()).toBe('Dos a la vez');
    });

    it('cada jugada tras la primera trae su frase (play2) o, si no la tiene, la de la primera', async () => {
      await iniciar(LESSONS['skewer']);
      hasta(INTRO_SECONDS + 0.1);
      expect(frase()).toBe('Jaque');

      hasta(MOVE_SECONDS + PAUSE_SECONDS);
      expect(frase()).toBe('El rey se aparta');

      // La tercera jugada no tiene `play3`: se queda la de la primera
      hasta(MOVE_SECONDS + PAUSE_SECONDS);
      expect(frase()).toBe('Jaque');
    });

    it('un patrón sin frases no rompe: la lección se ve, sin texto', async () => {
      await iniciar(LESSONS['pin']);
      hasta(1);

      expect(idea()).toBe('');
      expect(frase()).toBe('');
    });
  });

  describe('pruébalo tú', () => {
    const boton = () => fixture.nativeElement.querySelector('[data-testid=lesson-try]') as HTMLButtonElement | null;
    const alFinal = () => {
      avanzar((lessonDuration(LESSONS['fork']) + 0.5) * 1000);
      fixture.detectChanges();
    };
    const frase = () => fixture.nativeElement.querySelector('[data-testid=lesson-caption]').textContent.trim();
    const hasta = (segundos: number) => {
      avanzar(segundos * 1000);
      fixture.detectChanges();
    };
    /** Toca el centro de una casilla (el tablero de la prueba mide 320 px: casillas de 40). */
    const tocar = (columna: number, fila: number) => {
      const e = new MouseEvent('pointerdown', { clientX: columna * 40 + 20, clientY: fila * 40 + 20, bubbles: true });
      canvas().dispatchEvent(e);
      fixture.detectChanges();
    };
    // Con el caballo de f5 (columna 5, fila 3) a d6 (columna 3, fila 2)
    const F5 = [5, 3] as const;
    const D6 = [3, 2] as const;

    beforeEach(async () => {
      await iniciar(LESSONS['fork']);
      canvas().getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 320, right: 320, bottom: 320, x: 0, y: 0, toJSON: () => ({}) });
    });

    it('el botón sale cuando la lección acaba de contarse, y no antes', () => {
      hasta(1);
      expect(boton()).toBeNull();

      alFinal();

      expect(boton()).not.toBeNull();
      expect(terminadas).toBe(1);
    });

    it('al pulsarlo el tablero vuelve a la posición inicial y pide la jugada', () => {
      alFinal();

      boton()!.click();
      fixture.detectChanges();
      (ctx['drawImage'] as jest.Mock).mockClear();
      hasta(2);

      expect(frase()).toContain('lessonTryHint');
      expect(boton()).toBeNull();
      // Sigue la posición inicial: el caballo está en f5 (no se movió a d6)
      const caballos = (ctx['drawImage'] as jest.Mock).mock.calls.filter(([i]) => (i as { pieza: string }).pieza === 'wn').map((c) => [c[1], c[2]]);
      expect(new Set(caballos.map((c) => c.join(','))).size).toBe(1);
    });

    it('una jugada equivocada enrojece el tablero, dice que no y, pasado un momento, vuelve a la pista', () => {
      alFinal();
      boton()!.click();
      tocar(...F5);
      (ctx['fillRect'] as jest.Mock).mockClear();

      tocar(4, 4);
      hasta(0.1);

      expect(frase()).toContain('lessonTryWrong');
      // El destello rojo cubre todo el tablero
      expect((ctx['fillRect'] as jest.Mock).mock.calls.some((c) => c[2] === 320 && c[3] === 320)).toBe(true);
      hasta(2);
      expect(frase()).toContain('lessonTryHint');
    });

    it('la jugada buena sigue la lección desde ahí: se mueve la pieza y se explica', () => {
      alFinal();
      boton()!.click();

      tocar(...F5);
      tocar(...D6);
      hasta(0.2);

      expect(frase()).toBe('El caballo salta');
      // Y ya no se ofrece probar otra vez
      alFinal();
      expect(boton()).toBeNull();
      expect(frase()).toBe('Busca casillas dobles');
    });

    it('elegir una casilla vacía, una pieza negra o la misma casilla otra vez no selecciona nada', () => {
      alFinal();
      boton()!.click();

      // Vacía y rey negro (e8 = columna 4, fila 0): nada seleccionado
      tocar(0, 7);
      tocar(4, 0);
      tocar(...D6);
      expect(frase()).toContain('lessonTryHint');

      // Elegir y volver a tocar la misma deselecciona: tocar d6 después no es una jugada
      tocar(...F5);
      tocar(...F5);
      tocar(...D6);
      expect(frase()).toContain('lessonTryHint');
    });

    it('un toque fuera del tablero o sin estar probando no hace nada', () => {
      alFinal();
      tocar(...F5);
      tocar(...D6);
      expect(boton()).not.toBeNull();

      boton()!.click();
      canvas().dispatchEvent(new MouseEvent('pointerdown', { clientX: -10, clientY: 500, bubbles: true }));
      fixture.detectChanges();
      expect(frase()).toContain('lessonTryHint');
    });

    it('con el tablero sin tamaño (aún no maquetado) un toque se ignora', () => {
      alFinal();
      boton()!.click();
      canvas().getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) });

      expect(() => tocar(...F5)).not.toThrow();
    });
  });
});
