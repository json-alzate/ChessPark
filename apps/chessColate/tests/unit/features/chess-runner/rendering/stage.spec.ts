import { drawStage, StageAssets, StageDog, StageFrame, StageProp } from '@features/chess-runner/rendering/stage';
import { FEET_Y, RUNNER_HEIGHT } from '@features/chess-runner/rendering/scenery';
import { RunnerSprite } from '@features/chess-runner/services/runner-sprites.service';

const ANCHO = 200;

function sprite(frameW: number, frameH: number, frames = 1, fps = 8, image: unknown = {}): RunnerSprite {
  return { image: image as CanvasImageSource, frameW, frameH, frames, fps };
}

const IMG = {
  run: { id: 'perro-corre' },
  jump: { id: 'perro-salta' },
  hurt: { id: 'perro-dormido' },
  happy: { id: 'perro-contento' },
  idle: { id: 'perro-quieto' },
  spark: { id: 'chispa' },
  king: { id: 'rey' },
  pawn: { id: 'peon' },
};

const assets = (): StageAssets => ({
  sprites: new Map([
    ['dog-run', sprite(52, 40, 4, 12, IMG.run)],
    ['dog-jump', sprite(52, 40, 3, 1, IMG.jump)],
    ['dog-hurt', sprite(52, 40, 2, 8, IMG.hurt)],
    ['dog-happy', sprite(52, 40, 2, 6, IMG.happy)],
    ['dog-idle', sprite(44, 42, 2, 3, IMG.idle)],
    ['fx-spark', sprite(11, 11, 3, 14, IMG.spark)],
    ['scene-sky', sprite(4, 128)],
    ['scene-floor', sprite(32, 20)],
  ]),
  pieces: new Map<string, CanvasImageSource>([
    ['bk', IMG.king as unknown as CanvasImageSource],
    ['wp', IMG.pawn as unknown as CanvasImageSource],
  ]),
});

function contexto() {
  const ops: string[] = [];
  const ctx: Record<string, unknown> = {
    fillStyle: '',
    globalAlpha: 1,
    imageSmoothingEnabled: true,
    drawImage: jest.fn(),
    fillRect: jest.fn(),
    clearRect: jest.fn(),
    save: jest.fn(() => ops.push('save')),
    restore: jest.fn(() => ops.push('restore')),
    translate: jest.fn(),
    scale: jest.fn(),
    beginPath: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
  };
  return { ctx: ctx as unknown as Falso, ops };
}

/** El contexto falso: sus funciones de dibujo son simulacros de Jest que se pueden inspeccionar. */
type Falso = Record<'drawImage' | 'fillRect' | 'clearRect' | 'save' | 'restore' | 'translate' | 'scale' | 'beginPath' | 'arc' | 'fill', jest.Mock> & {
  fillStyle: string;
  globalAlpha: number;
  imageSmoothingEnabled: boolean;
};

/** Pinta con el contexto falso, como si fuera el de verdad. */
const pintar = (ctx: Falso, assets: StageAssets, width: number, time: number, frame: StageFrame) =>
  drawStage(ctx as unknown as CanvasRenderingContext2D, assets, width, time, frame);

const marco = (extra: Partial<StageFrame> = {}): StageFrame => ({
  world: 'day',
  scroll: 0,
  dog: null,
  props: [],
  fade: 0,
  flash: 0,
  ...extra,
});
const perro = (extra: Partial<StageDog> = {}): StageDog => ({ x: 60, y: 0, pose: 'run', ...extra });
const imagenes = (ctx: Falso) => ctx.drawImage.mock.calls.map((c: unknown[]) => c[0]);

describe('drawStage', () => {
  // jsdom no dibuja: sin contexto, teñir una pieza devuelve la pieza tal cual (sin ruido en la consola)
  beforeEach(() => {
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });
  afterEach(() => jest.restoreAllMocks());

  it('limpia el lienzo, pinta el escenario y el suelo, y apaga el suavizado', () => {
    const { ctx } = contexto();

    pintar(ctx, assets(), ANCHO, 0, marco());

    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, ANCHO, RUNNER_HEIGHT);
    expect(ctx.imageSmoothingEnabled).toBe(false);
    expect(ctx.drawImage).toHaveBeenCalled();
  });

  describe('el perrito', () => {
    const imagenDe = (pose: StageDog['pose']) => {
      const { ctx } = contexto();
      pintar(ctx, assets(), ANCHO, 0, marco({ dog: perro({ pose }) }));
      return imagenes(ctx).filter((i) => Object.values(IMG).includes(i as never));
    };

    it.each([
      ['run', IMG.run],
      ['jump', IMG.jump],
      ['happy', IMG.happy],
      ['idle', IMG.idle],
      ['hurt', IMG.hurt],
      ['sleep', IMG.hurt],
    ] as const)('en pose «%s» usa su sprite', (pose, imagen) => {
      expect(imagenDe(pose)).toContain(imagen);
    });

    it('con los pies en el suelo: la base del sprite cae en la altura de los pies', () => {
      const { ctx } = contexto();
      pintar(ctx, assets(), ANCHO, 0, marco({ dog: perro() }));

      const llamada = ctx.drawImage.mock.calls.find((c: unknown[]) => c[0] === IMG.run)!;
      expect(llamada[6] + llamada[8]).toBe(FEET_Y);
      // Centrado en x
      expect(llamada[5] + llamada[7] / 2).toBe(60);
    });

    it('en el aire se dibuja más arriba', () => {
      const alto = (y: number) => {
        const { ctx } = contexto();
        pintar(ctx, assets(), ANCHO, 0, marco({ dog: perro({ y }) }));
        return ctx.drawImage.mock.calls.find((c: unknown[]) => c[0] === IMG.run)![6] as number;
      };

      expect(alto(30)).toBe(alto(0) - 30);
    });

    it('corriendo, las patas siguen al suelo: el cuadro cambia con lo que ha pasado', () => {
      const cuadro = (scroll: number) => {
        const { ctx } = contexto();
        pintar(ctx, assets(), ANCHO, 0, marco({ scroll, dog: perro() }));
        return ctx.drawImage.mock.calls.find((c: unknown[]) => c[0] === IMG.run)![1] as number;
      };

      expect(new Set([0, 12, 24, 36].map(cuadro)).size).toBeGreaterThan(2);
    });

    it('mirando a la izquierda se refleja', () => {
      const { ctx } = contexto();
      pintar(ctx, assets(), ANCHO, 0, marco({ dog: perro({ flip: true }) }));

      expect(ctx.scale).toHaveBeenCalledWith(-1, 1);
    });

    it('lleva su equipo solo corriendo o saltando, a escala normal', () => {
      const rects = (pose: StageDog['pose'], scale?: number) => {
        const { ctx } = contexto();
        pintar(ctx, assets(), ANCHO, 0, marco({ dog: perro({ pose, scale, gear: ['crown', 'cloak'] }) }));
        return ctx.fillRect.mock.calls.length;
      };
      const sinEquipo = (() => {
        const { ctx } = contexto();
        pintar(ctx, assets(), ANCHO, 0, marco({ dog: perro() }));
        return ctx.fillRect.mock.calls.length;
      })();

      expect(rects('run')).toBeGreaterThan(sinEquipo);
      expect(rects('jump')).toBeGreaterThan(sinEquipo);
      expect(rects('idle')).toBe(sinEquipo);
      expect(rects('run', 2)).toBe(sinEquipo);
    });

    it('sin el sprite no pinta al perrito pero no lanza', () => {
      const { ctx } = contexto();

      expect(() => pintar(ctx, { sprites: new Map(), pieces: new Map() }, ANCHO, 0, marco({ dog: perro() }))).not.toThrow();
    });
  });

  describe('los objetos', () => {
    const conObjeto = (prop: StageProp) => {
      const { ctx } = contexto();
      pintar(ctx, assets(), ANCHO, 0, marco({ props: [prop] }));
      return ctx;
    };

    it('una pieza se dibuja con la imagen de su clave, suavizada, y vuelve el pixel art nítido', () => {
      const suavizado: boolean[] = [];
      const { ctx } = contexto();
      ctx.drawImage.mockImplementation((imagen: unknown) => {
        if (imagen === IMG.pawn) suavizado.push(ctx.imageSmoothingEnabled as boolean);
      });

      pintar(ctx, assets(), ANCHO, 0, marco({ props: [{ kind: 'piece', key: 'wp', x: 100, y: 0, scale: 2 }] }));

      expect(suavizado).toEqual([true]);
      expect(ctx.imageSmoothingEnabled).toBe(false);
      const llamada = ctx.drawImage.mock.calls.find((c: unknown[]) => c[0] === IMG.pawn)!;
      expect(llamada[3]).toBe(60);
    });

    it('un globo se dibuja con su borde, su relleno claro y sus dibujitos en fila, y respeta su transparencia', () => {
      const ctx = conObjeto({ kind: 'bubble', x: 80, y: 50, icons: ['jar', 'arrow'], tail: 70, alpha: 0.5 });
      // Borde, relleno, colita y los píxeles de los dibujitos
      expect(ctx.fillRect.mock.calls.length).toBeGreaterThan(40);
    });

    it('un globo sin dibujitos no rompe', () => {
      expect(() => conObjeto({ kind: 'bubble', x: 80, y: 50, icons: [] })).not.toThrow();
    });

    it('una pieza que no está en el set no se dibuja', () => {
      expect(imagenes(conObjeto({ kind: 'piece', key: 'bz', x: 100, y: 0, scale: 1 }))).not.toContain(IMG.pawn);
    });

    it('con ojos, dos rectángulos rojos', () => {
      const ctx = conObjeto({ kind: 'piece', key: 'bk', x: 100, y: 0, scale: 2, tint: 'shadow', eyes: 1 });
      const rojos = (ctx.fillRect.mock.calls as unknown[][]).length;

      expect(rojos).toBeGreaterThanOrEqual(2);
    });

    it('la silueta de sombra se dibuja desde una copia teñida, y se reutiliza', () => {
      const lienzo = { drawImage: jest.fn(), fillRect: jest.fn(), globalCompositeOperation: '', fillStyle: '' };
      const crear = jest.spyOn(document, 'createElement');
      (HTMLCanvasElement.prototype.getContext as jest.Mock).mockReturnValue(lienzo as unknown as CanvasRenderingContext2D);
      // Una pieza que ninguna otra prueba ha teñido: la copia teñida se guarda por pieza y tamaño
      const rey = { id: 'rey-para-teñir' } as unknown as CanvasImageSource;
      const a = { ...assets(), pieces: new Map<string, CanvasImageSource>([['bk', rey]]) };
      const { ctx } = contexto();
      const sombra: StageProp = { kind: 'piece', key: 'bk', x: 100, y: 0, scale: 2, tint: 'shadow' };

      pintar(ctx, a, ANCHO, 0, marco({ props: [sombra] }));
      pintar(ctx, a, ANCHO, 1, marco({ props: [sombra] }));

      expect(lienzo.globalCompositeOperation).toBe('source-atop');
      expect(crear.mock.calls.filter(([tag]) => tag === 'canvas')).toHaveLength(1);
      expect(imagenes(ctx)).not.toContain(rey);
    });

    it('si no se puede teñir, se dibuja la pieza tal cual', () => {
      const { ctx } = contexto();
      const a = { ...assets(), pieces: new Map<string, CanvasImageSource>([['bk', { id: 'rey-nuevo' } as unknown as CanvasImageSource]]) };

      pintar(ctx, a, ANCHO, 0, marco({ props: [{ kind: 'piece', key: 'bk', x: 100, y: 0, scale: 3, tint: 'shadow' }] }));

      expect(imagenes(ctx)).toContainEqual({ id: 'rey-nuevo' });
    });

    it('la galleta, el frasco, el peldaño, la alerta, la estrella y el poder se pintan con píxeles', () => {
      for (const prop of [
        { kind: 'cookie', x: 50, y: 10 },
        { kind: 'jar', x: 60, y: 4, glow: 1 },
        { kind: 'pedestal', x: 70 },
        { kind: 'alert', x: 80, y: 40 },
        { kind: 'star', x: 90, y: 60, scale: 1.5, filled: true },
        { kind: 'star', x: 90, y: 60, scale: 1, filled: false },
        { kind: 'power', id: 'crown', x: 100, y: 40, scale: 2, alpha: 0.5 },
      ] as StageProp[]) {
        expect(conObjeto(prop).fillRect.mock.calls.length).toBeGreaterThan(5);
      }
    });

    it('el frasco con brillo dibuja un halo', () => {
      expect(conObjeto({ kind: 'jar', x: 60, y: 4, glow: 1 }).arc).toHaveBeenCalled();
      expect(conObjeto({ kind: 'jar', x: 60, y: 4 }).arc).not.toHaveBeenCalled();
    });

    it('la chispa usa el sprite de chispas, y va cambiando de cuadro con el tiempo', () => {
      const cuadro = (phase: number) => conObjeto({ kind: 'spark', x: 60, y: 20, phase }).drawImage.mock.calls.find((c: unknown[]) => c[0] === IMG.spark)![1] as number;

      expect(cuadro(0)).toBe(0);
      expect(cuadro(0.1)).toBe(11);
    });

    it('el peldaño se dibuja detrás del perrito, y lo demás delante', () => {
      const { ctx } = contexto();
      const orden: string[] = [];
      ctx.drawImage.mockImplementation((imagen: unknown) => {
        if (imagen === IMG.run) orden.push('perro');
      });
      ctx.fillRect.mockImplementation(() => orden.push('pixel'));

      pintar(ctx, assets(), ANCHO, 0, marco({ dog: perro(), props: [{ kind: 'pedestal', x: 60 }, { kind: 'alert', x: 60, y: 40 }] }));
      const iPerro = orden.indexOf('perro');
      const pixeles = orden.filter((o) => o === 'pixel').length;

      expect(iPerro).toBeGreaterThan(-1);
      // Hay píxeles antes (peldaño) y después (alerta) del perrito
      expect(orden.slice(0, iPerro).filter((o) => o === 'pixel').length).toBeGreaterThan(0);
      expect(orden.slice(iPerro).filter((o) => o === 'pixel').length).toBeGreaterThan(0);
      expect(pixeles).toBeGreaterThan(10);
    });
  });

  describe('destello y oscurecido', () => {
    const ultimoRelleno = (extra: Partial<StageFrame>) => {
      const { ctx } = contexto();
      pintar(ctx, assets(), ANCHO, 0, marco(extra));
      return ctx.fillRect.mock.calls.filter((c: number[]) => c[2] === ANCHO && c[3] === RUNNER_HEIGHT);
    };

    it('sin destello ni oscuridad no se tapa nada', () => {
      expect(ultimoRelleno({})).toHaveLength(0);
    });

    it('con destello, un velo blanco a todo el lienzo', () => {
      expect(ultimoRelleno({ flash: 0.6 })).toHaveLength(1);
    });

    it('con oscuridad, un velo negro; con las dos, el negro va encima', () => {
      expect(ultimoRelleno({ fade: 1 })).toHaveLength(1);
      expect(ultimoRelleno({ fade: 1, flash: 1 })).toHaveLength(2);
    });
  });
});
