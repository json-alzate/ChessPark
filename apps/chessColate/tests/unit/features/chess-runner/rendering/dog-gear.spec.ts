import { POWER_IDS, RunnerPowerId } from '@features/chess-runner/campaign/runner-curriculum';
import { DOG_FRAME_H, DOG_FRAME_W, drawDogGear, gearCount } from '@features/chess-runner/rendering/dog-gear';

function contexto() {
  const rects: { x: number; y: number; w: number; h: number; color: string }[] = [];
  const ctx = { fillStyle: '' } as unknown as CanvasRenderingContext2D & { fillRect: jest.Mock };
  ctx.fillRect = jest.fn((x: number, y: number, w: number, h: number) => {
    rects.push({ x, y, w, h, color: ctx.fillStyle as string });
  });
  return { ctx, rects };
}

const dibujar = (gear: RunnerPowerId[], opciones: { flip?: boolean; airborne?: boolean; time?: number } = {}) => {
  const { ctx, rects } = contexto();
  drawDogGear(ctx, gear, 100, 50, { time: opciones.time ?? 0, flip: opciones.flip, airborne: opciones.airborne });
  return rects;
};
const colores = (rects: { color: string }[]) => new Set(rects.map((r) => r.color));

describe('el equipo del perrito', () => {
  it('sin poderes no se dibuja nada', () => {
    expect(dibujar([])).toEqual([]);
    expect(gearCount([])).toBe(0);
    expect(gearCount(new Set<RunnerPowerId>(['nose', 'crown']))).toBe(2);
  });

  // El escudo no es una prenda (lo dibuja la carrera como una burbuja): ver más abajo
  it.each(POWER_IDS.filter((p) => p !== 'shield'))('el poder «%s» se ve: pinta algo', (poder) => {
    expect(dibujar([poder]).length).toBeGreaterThan(0);
  });

  it('cada poder se pinta de su color, distinto de los demás', () => {
    const color = (poder: RunnerPowerId) => [...colores(dibujar([poder]))].sort().join('|');
    const todos = POWER_IDS.filter((p) => p !== 'shield').map(color);

    expect(new Set(todos).size).toBe(todos.length);
  });

  it('el escudo no es una prenda: es una burbuja que dibuja la carrera, no el equipo', () => {
    expect(dibujar(['shield'])).toEqual([]);
  });

  it('con más poderes se pinta más', () => {
    expect(dibujar(['cloak', 'crown', 'trail']).length).toBeGreaterThan(dibujar(['cloak']).length);
  });

  it('todo cae dentro (o pegado) al cuadro del perrito', () => {
    const rects = dibujar([...POWER_IDS]);

    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(100 - 12);
      expect(r.x + r.w).toBeLessThanOrEqual(100 + DOG_FRAME_W + 6);
      expect(r.y).toBeGreaterThanOrEqual(50 - 6);
      expect(r.y + r.h).toBeLessThanOrEqual(50 + DOG_FRAME_H + 4);
    }
  });

  it('la capa y la bufanda ondean: cambian con el tiempo', () => {
    const forma = (t: number) => JSON.stringify(dibujar(['cloak', 'trail'], { time: t }));

    expect(new Set([0, 0.1, 0.2, 0.3].map(forma)).size).toBeGreaterThan(1);
  });

  it('la corona está encima de la cabeza y la capa por detrás del cuerpo', () => {
    const corona = dibujar(['crown']);
    const capa = dibujar(['cloak']);

    expect(Math.min(...corona.map((r) => r.y))).toBeLessThan(50 + 8);
    expect(Math.max(...corona.map((r) => r.x))).toBeGreaterThan(Math.max(...capa.map((r) => r.x)));
  });

  it('con el perrito mirando a la izquierda todo se refleja', () => {
    const derecha = dibujar(['cloak', 'crown']);
    const izquierda = dibujar(['cloak', 'crown'], { flip: true });

    expect(izquierda).toHaveLength(derecha.length);
    // Lo que estaba a la derecha del cuadro pasa a la izquierda, y al revés
    const centro = 100 + DOG_FRAME_W / 2;
    const lado = (rects: { x: number; w: number }[]) => rects.reduce((suma, r) => suma + (r.x + r.w / 2 - centro), 0);
    expect(Math.sign(lado(derecha))).toBe(-Math.sign(lado(izquierda)));
  });

  it('los muelles se estiran en el aire', () => {
    const suelo = dibujar(['spring'], { airborne: false });
    const aire = dibujar(['spring'], { airborne: true });

    expect(Math.min(...aire.map((r) => r.y))).toBeGreaterThan(Math.min(...suelo.map((r) => r.y)));
  });

  it('acepta el equipo como un conjunto o como una lista', () => {
    const { ctx, rects } = contexto();
    drawDogGear(ctx, new Set<RunnerPowerId>(['crown']), 0, 0, { time: 0 });

    expect(rects.length).toBeGreaterThan(0);
  });
});
