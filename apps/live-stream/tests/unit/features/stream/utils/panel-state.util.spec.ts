import { countdownDisplay, formatClock } from '@features/stream/utils/panel-state.util';

describe('formatClock', () => {
  it('da mm:ss con ceros a la izquierda', () => {
    expect(formatClock(9)).toBe('00:09');
    expect(formatClock(75)).toBe('01:15');
    expect(formatClock(462)).toBe('07:42');
  });

  it('no baja de cero', () => {
    expect(formatClock(-3)).toBe('00:00');
  });
});

describe('countdownDisplay', () => {
  it('mientras se mira la posición muestra el tiempo completo y la barra llena', () => {
    expect(countdownDisplay('presentacion', 10, 10)).toMatchObject({ big: '00:10', progress: 1 });
    expect(countdownDisplay('rival', 10, 10)).toMatchObject({ big: '00:10', progress: 1 });
  });

  it('en la cuenta atrás la barra baja con el tiempo', () => {
    expect(countdownDisplay('cuenta', 5, 10)).toEqual({
      headline: 'Can you see it?',
      big: '00:05',
      bigIsText: false,
      progress: 0.5,
    });
  });

  it('en la solución y el cierre usa palabras, no dígitos', () => {
    expect(countdownDisplay('solucion', 0, 10).bigIsText).toBe(true);
    expect(countdownDisplay('cierre', 0, 10).bigIsText).toBe(true);
  });

  it('no se rompe con una cuenta atrás de 0 segundos', () => {
    expect(countdownDisplay('cuenta', 0, 0).progress).toBe(0);
  });
});
