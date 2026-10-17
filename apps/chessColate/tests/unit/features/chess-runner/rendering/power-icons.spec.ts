import { POWER_IDS } from '@features/chess-runner/campaign/runner-curriculum';
import { iconSize, POWER_ICONS, powerIconUrl } from '@features/chess-runner/rendering/power-icons';

describe('los iconos de los poderes', () => {
  it.each(POWER_IDS)('«%s» tiene su dibujo, con las filas del mismo ancho y todos sus colores en la paleta', (id) => {
    const { art, palette } = POWER_ICONS[id];
    const ancho = art[0].length;

    expect(art.length).toBeGreaterThanOrEqual(4);
    expect(art.length).toBeLessThanOrEqual(8);
    expect(art.every((fila) => fila.length === ancho)).toBe(true);
    for (const caracter of new Set(art.join('').replace(/\./g, ''))) {
      expect(palette[caracter]).toBeDefined();
    }
    expect(iconSize(id)).toEqual({ width: ancho, height: art.length });
  });

  it('todos los poderes tienen icono, y ninguno está repetido', () => {
    expect(Object.keys(POWER_ICONS).sort()).toEqual([...POWER_IDS].sort());
    const formas = POWER_IDS.map((id) => POWER_ICONS[id].art.join('/'));
    expect(new Set(formas).size).toBe(POWER_IDS.length);
  });

  describe('powerIconUrl', () => {
    it('devuelve una imagen (data:) cuando el navegador puede dibujar, y la guarda', () => {
      const dibujado: unknown[] = [];
      const ctx = { fillStyle: '', fillRect: jest.fn((...a: unknown[]) => dibujado.push(a)) };
      const crear = jest.spyOn(document, 'createElement');
      jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
      jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAA');

      expect(powerIconUrl('crown', 7)).toBe('data:image/png;base64,AAA');
      expect(dibujado.length).toBeGreaterThan(10);
      const llamadas = crear.mock.calls.length;
      expect(powerIconUrl('crown', 7)).toBe('data:image/png;base64,AAA');
      expect(crear.mock.calls.length).toBe(llamadas);
      jest.restoreAllMocks();
    });

    it('sin contexto de dibujo (una prueba, un navegador viejo) devuelve vacío y no lanza', () => {
      jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

      expect(powerIconUrl('heart', 9)).toBe('');
      jest.restoreAllMocks();
    });

    it('si dibujar falla, también devuelve vacío', () => {
      jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
        throw new Error('sin canvas');
      });

      expect(powerIconUrl('net', 11)).toBe('');
      jest.restoreAllMocks();
    });
  });
});
