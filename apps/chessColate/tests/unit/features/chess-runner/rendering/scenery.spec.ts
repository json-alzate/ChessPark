import { WORLDS, RunnerWorld } from '@features/chess-runner/campaign/runner-curriculum';
import { drawGround, drawScenery, FEET_Y, GROUND_Y, RUNNER_HEIGHT, SceneryView, WORLD_TINT } from '@features/chess-runner/rendering/scenery';
import { RunnerSprite } from '@features/chess-runner/services/runner-sprites.service';

const ANCHO = 200;

function sprite(frameW: number, frameH: number, image: unknown = {}): RunnerSprite {
  return { image: image as CanvasImageSource, frameW, frameH, frames: 1, fps: 1 };
}

const IMAGENES = {
  sky: { img: 'cielo' },
  nube0: { img: 'nube0' },
  nube1: { img: 'nube1' },
  horizonte: { img: 'horizonte' },
  colinas: { img: 'colinas' },
  suelo: { img: 'suelo' },
};

function sprites(): Map<string, RunnerSprite> {
  return new Map([
    ['scene-sky', sprite(4, 128, IMAGENES.sky)],
    ['scene-cloud-0', sprite(50, 22, IMAGENES.nube0)],
    ['scene-cloud-1', sprite(40, 22, IMAGENES.nube1)],
    ['scene-skyline', sprite(192, 92, IMAGENES.horizonte)],
    ['scene-hills', sprite(128, 44, IMAGENES.colinas)],
    ['scene-floor', sprite(32, 20, IMAGENES.suelo)],
  ]);
}

function contexto() {
  const colores: string[] = [];
  const ctx: Record<string, unknown> = {
    fillStyle: '',
    drawImage: jest.fn(),
    fillRect: jest.fn(() => colores.push(String(ctx['fillStyle']))),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D & { drawImage: jest.Mock; fillRect: jest.Mock }, colores };
}

const vista = (cambios: Partial<SceneryView> = {}): SceneryView => ({ width: ANCHO, distance: 0, time: 1, world: 'day', ...cambios });
const imagenes = (ctx: { drawImage: jest.Mock }) => ctx.drawImage.mock.calls.map((c) => c[0]);

describe('el escenario', () => {
  it('el suelo está más abajo que el cielo y los pies del perrito, en mitad de las casillas', () => {
    expect(GROUND_Y).toBeLessThan(RUNNER_HEIGHT);
    expect(FEET_Y).toBeGreaterThan(GROUND_Y);
    expect(FEET_Y).toBeLessThan(RUNNER_HEIGHT);
  });

  describe('drawScenery', () => {
    it('dibuja el cielo estirado a todo el ancho, y las capas de atrás hacia delante', () => {
      const { ctx } = contexto();

      drawScenery(ctx, sprites(), vista());

      const llamadas = ctx.drawImage.mock.calls;
      expect(llamadas[0][0]).toBe(IMAGENES.sky);
      expect(llamadas[0].slice(5)).toEqual([0, 0, ANCHO, GROUND_Y + 6]);
      const orden = imagenes(ctx);
      expect(orden.indexOf(IMAGENES.sky)).toBeLessThan(orden.indexOf(IMAGENES.nube0));
      expect(orden.indexOf(IMAGENES.nube0)).toBeLessThan(orden.indexOf(IMAGENES.horizonte));
      expect(orden.indexOf(IMAGENES.horizonte)).toBeLessThan(orden.indexOf(IMAGENES.colinas));
    });

    it('repite el horizonte y las colinas para cubrir todo el ancho', () => {
      const { ctx } = contexto();

      drawScenery(ctx, sprites(), vista({ width: 400 }));

      expect(imagenes(ctx).filter((i) => i === IMAGENES.colinas).length).toBeGreaterThanOrEqual(3);
      expect(imagenes(ctx).filter((i) => i === IMAGENES.horizonte).length).toBeGreaterThanOrEqual(2);
    });

    it('las capas se mueven a distinta velocidad con lo que avanza el suelo (paralaje)', () => {
      const posicion = (distance: number, imagen: unknown) => {
        const { ctx } = contexto();
        drawScenery(ctx, sprites(), vista({ distance }));
        return ctx.drawImage.mock.calls.find((c) => c[0] === imagen)![1] as number;
      };

      const colinas = posicion(0, IMAGENES.colinas) - posicion(100, IMAGENES.colinas);
      const horizonte = posicion(0, IMAGENES.horizonte) - posicion(100, IMAGENES.horizonte);

      expect(colinas).toBeGreaterThan(horizonte);
      expect(horizonte).toBeGreaterThan(0);
    });

    it('sin los sprites cargados no lanza: dibuja lo que puede', () => {
      const { ctx } = contexto();

      expect(() => drawScenery(ctx, new Map(), vista({ world: 'night' }))).not.toThrow();
    });

    describe('cada mundo tiene su aspecto', () => {
      const coloresDe = (world: RunnerWorld, time = 1) => {
        const { ctx, colores } = contexto();
        drawScenery(ctx, sprites(), vista({ world, time }));
        return colores;
      };

      it('de día, un sol amarillo y ningún tinte', () => {
        const colores = coloresDe('day');

        expect(colores).toContain('#ffe27a');
        expect(WORLD_TINT.day).toBeNull();
      });

      it('al atardecer, un sol grande y naranja, y el cielo teñido', () => {
        const colores = coloresDe('sunset');

        expect(colores).toContain('#ff9a3c');
        expect(colores).toContain(WORLD_TINT.sunset);
      });

      it('de noche, la luna con sus cráteres y diez estrellas', () => {
        const colores = coloresDe('night');

        expect(colores).toContain('#f4f1d0');
        expect(colores).toContain('#d9d5ad');
        expect(colores.filter((c) => /^rgba\(255, 255, 255, 0\.(55|95)\)$/.test(c))).toHaveLength(10);
      });

      it('las estrellas titilan: cambian de brillo con el tiempo', () => {
        const brillo = (t: number) => coloresDe('night', t).filter((c) => c.endsWith('0.55)')).length;

        expect(new Set([0, 0.5, 1, 1.5, 2].map(brillo)).size).toBeGreaterThan(1);
      });

      it('con niebla, bandas claras que no están en los demás mundos', () => {
        expect(coloresDe('mist')).toContain('rgba(232, 238, 245, 0.24)');
        expect(coloresDe('day')).not.toContain('rgba(232, 238, 245, 0.24)');
      });

      it('al amanecer, el sol rosado asomando', () => {
        expect(coloresDe('dawn')).toContain('#ffd1a1');
      });

      it('en la tormenta, lluvia, estrellas tapadas por la tinta oscura y un relámpago de vez en cuando', () => {
        const lluvia = coloresDe('storm', 1).filter((c) => c === 'rgba(190, 200, 230, 0.5)');

        expect(lluvia).toHaveLength(18);
        expect(coloresDe('storm', 0)).toContain('rgba(255, 250, 220, 0.30)');
        expect(coloresDe('storm', 1)).not.toContain('rgba(255, 250, 220, 0.30)');
      });

      it('todos los mundos tienen su tinte definido, y los tintes son translúcidos', () => {
        expect(Object.keys(WORLD_TINT).sort()).toEqual([...WORLDS].sort());
        for (const tinte of Object.values(WORLD_TINT)) {
          if (tinte) {
            expect(tinte).toMatch(/^rgba\(.+, 0\.\d+\)$/);
          }
        }
      });
    });
  });

  describe('drawGround', () => {
    it('cubre todo el ancho con losetas y debajo pone la madera', () => {
      const { ctx, colores } = contexto();

      drawGround(ctx, sprites(), 100, 0);

      expect(imagenes(ctx).every((i) => i === IMAGENES.suelo)).toBe(true);
      expect(ctx.drawImage.mock.calls.length).toBeGreaterThanOrEqual(Math.ceil(100 / 32));
      expect(colores).toContain('#3a2418');
    });

    it('el suelo pasa: la loseta se desplaza con la distancia y se repite cada ancho de loseta', () => {
      const primera = (distance: number) => {
        const { ctx } = contexto();
        drawGround(ctx, sprites(), 100, distance);
        return ctx.drawImage.mock.calls[0][1] as number;
      };

      expect(primera(0)).toBeCloseTo(0, 9);
      expect(primera(10)).toBe(-10);
      expect(primera(32)).toBeCloseTo(primera(0), 9);
    });

    it('sin el sprite del suelo no pinta nada', () => {
      const { ctx } = contexto();

      drawGround(ctx, new Map(), 100, 0);

      expect(ctx.drawImage).not.toHaveBeenCalled();
      expect(ctx.fillRect).not.toHaveBeenCalled();
    });
  });
});
