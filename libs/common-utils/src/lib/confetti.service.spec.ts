jest.mock('canvas-confetti', () => ({ __esModule: true, default: jest.fn() }));

import { ConfettiService, CONFETTI_Z_INDEX } from './confetti.service';

describe('ConfettiService', () => {
  const lanzar = jest.requireMock('canvas-confetti').default as jest.Mock;
  let service: ConfettiService;

  beforeEach(() => {
    lanzar.mockClear();
    service = new ConfettiService();
  });

  it('el confeti queda por encima de los modales de Ionic (z-index desde 20000), no detrás', () => {
    expect(CONFETTI_Z_INDEX).toBeGreaterThan(20999);
  });

  it.each([
    ['launchFromPosition', (s: ConfettiService) => s.launchFromPosition(0.5, 0.5)],
    ['launchExplosion', (s: ConfettiService) => s.launchExplosion()],
  ])('%s lo dibuja en esa capa', (_nombre, accion) => {
    accion(service);

    expect(lanzar).toHaveBeenCalled();
    for (const [opciones] of lanzar.mock.calls) {
      expect(opciones.zIndex).toBe(CONFETTI_Z_INDEX);
    }
  });

  it('launch (el que usan Coordenadas, Racha y el resumen) también', () => {
    jest.useFakeTimers();
    try {
      service.launch(['#fff'], 1000, 'high');
      jest.advanceTimersByTime(300);
    } finally {
      jest.useRealTimers();
    }

    expect(lanzar).toHaveBeenCalled();
    for (const [opciones] of lanzar.mock.calls) {
      expect(opciones.zIndex).toBe(CONFETTI_Z_INDEX);
    }
  });

  it('un zIndex pasado a mano sigue mandando', () => {
    service.launchFromPosition(0.1, 0.1, undefined, { zIndex: 5 });

    expect(lanzar.mock.calls[0][0].zIndex).toBe(5);
  });
});
