import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideTranslocoTesting } from '@tests/support/transloco-testing';

import { RunnerStoryComponent } from '@features/chess-runner/components/runner-story/runner-story.component';
import { StageFrame } from '@features/chess-runner/rendering/stage';
import { RunnerPiecesService } from '@features/chess-runner/services/runner-pieces.service';
import { RunnerSprite, RunnerSpritesService } from '@features/chess-runner/services/runner-sprites.service';
import { StoryScene } from '@features/chess-runner/story/story-scenes';

// La librería del tablero arrastra cm-chessboard, que Jest no carga: el servicio de piezas solo usa su tabla
jest.mock('@chesspark/board', () => ({
  CHESSBOARD_ASSETS_URL: 'assets/cm-chessboard/assets/',
  PIECES_FILES: { cburnett: 'pieces/standard.svg' },
  getChessboardAppearance: () => ({ pieces: 'cburnett', board: 'default' }),
}));

function contextoFalso() {
  const base: Record<string, unknown> = {
    setTransform: jest.fn(),
    drawImage: jest.fn(),
    fillRect: jest.fn(),
    clearRect: jest.fn(),
  };
  return new Proxy(base, {
    get: (target, prop: string) => (prop in target ? target[prop] : jest.fn()),
    set: (target, prop: string, value) => {
      target[prop] = value;
      return true;
    },
  });
}

const sprite = (w: number, h: number, frames = 1): RunnerSprite => ({ image: {} as CanvasImageSource, frameW: w, frameH: h, frames, fps: 8 });

function spritesFalsos() {
  return new Map<string, RunnerSprite>([
    ['dog-run', sprite(52, 40, 4)],
    ['scene-sky', sprite(4, 128)],
    ['scene-floor', sprite(32, 20)],
  ]);
}

describe('RunnerStoryComponent', () => {
  let fixture: ComponentFixture<RunnerStoryComponent>;
  let ctx: ReturnType<typeof contextoFalso>;
  const sprites = { load: jest.fn() };
  const piezas = { load: jest.fn() };
  let terminadas = 0;
  let fallos = 0;
  const tiempos: number[] = [];

  /** Una escena de prueba de 3 s: anota en qué instante se le pide cada fotograma. */
  const escena: StoryScene = {
    id: 'intro',
    chapter: 1,
    duration: 3,
    frame: (t): StageFrame => {
      tiempos.push(t);
      return { world: 'day', scroll: t * 100, dog: { x: 60, y: 0, pose: 'run' }, props: [], fade: 0, flash: 0 };
    },
  };

  const canvas = () => fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
  const avanzar = (ms: number) => jest.advanceTimersByTime(ms);

  async function iniciar(scene: StoryScene = escena, ancho = 393) {
    fixture = TestBed.createComponent(RunnerStoryComponent);
    fixture.componentInstance.scene = scene;
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
    tiempos.length = 0;
    ctx = contextoFalso();
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    sprites.load.mockResolvedValue(spritesFalsos());
    piezas.load.mockResolvedValue({ images: new Map(), urls: new Map() });
    await TestBed.configureTestingModule({
      imports: [RunnerStoryComponent],
      providers: [
        provideTranslocoTesting({ CHESS_RUNNER: { story: { intro: 'El perrito llega a un mundo nuevo' } } }),
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

  it('tiene una etiqueta que cuenta qué pasa, para quien no ve el lienzo', async () => {
    await iniciar();

    expect(canvas().getAttribute('role')).toBe('img');
    expect(canvas().getAttribute('aria-label')).toBe('El perrito llega a un mundo nuevo');
  });

  it('el lienzo mide lo mismo que el de la carrera: escala entera y alto fijo', async () => {
    await iniciar(escena, 393);

    // 393 / 220 = 1,8 → escala 2: 196 px lógicos de ancho
    expect(canvas().style.width).toBe('392px');
    expect(canvas().style.height).toBe('352px');
    expect(ctx['setTransform']).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
  });

  it('pinta fotogramas pidiéndole a la escena cada instante, sin pasarse de su duración', async () => {
    await iniciar();

    avanzar(500);
    avanzar(1000);
    expect(tiempos.length).toBeGreaterThan(20);
    expect(tiempos[0]).toBeLessThan(0.1);
    expect(tiempos[tiempos.length - 1]).toBeGreaterThan(1.2);
    expect(Math.max(...tiempos)).toBeLessThanOrEqual(3);
    expect((ctx['clearRect'] as jest.Mock).mock.calls.length).toBe(tiempos.length);
  });

  it('avisa una sola vez de que terminó, y deja de pintar con la imagen final puesta', async () => {
    await iniciar();

    avanzar(2800);
    expect(terminadas).toBe(0);
    avanzar(400);
    expect(terminadas).toBe(1);

    const pintados = tiempos.length;
    avanzar(5000);
    expect(terminadas).toBe(1);
    expect(tiempos.length).toBe(pintados);
    // El último fotograma es el del final de la escena
    expect(tiempos[tiempos.length - 1]).toBe(3);
  });

  it('si no se cargan los dibujos avisa con «failed» y no pinta', async () => {
    sprites.load.mockRejectedValue(new Error('sin red'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await iniciar();
    avanzar(1000);

    expect(fallos).toBe(1);
    expect(terminadas).toBe(0);
    expect(tiempos).toEqual([]);
  });

  it('sin contexto de dibujo también avisa de que no puede', async () => {
    (HTMLCanvasElement.prototype.getContext as jest.Mock).mockReturnValue(null);

    await iniciar();

    expect(fallos).toBe(1);
  });

  it('al destruirse deja de pintar y no avisa', async () => {
    await iniciar();
    avanzar(300);
    fixture.destroy();
    const pintados = tiempos.length;

    avanzar(10_000);

    expect(tiempos.length).toBe(pintados);
    expect(terminadas).toBe(0);
  });
});
