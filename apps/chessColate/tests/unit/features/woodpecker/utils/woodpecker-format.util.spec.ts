import {
  formatDuration,
  roundedPercent,
  trend,
} from '@features/woodpecker/utils/woodpecker-format.util';

describe('formatDuration', () => {
  it('da minutos y segundos con los segundos siempre a dos cifras', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(5_000)).toBe('0:05');
    expect(formatDuration(65_000)).toBe('1:05');
    expect(formatDuration(754_000)).toBe('12:34');
  });

  it('a partir de una hora añade las horas', () => {
    expect(formatDuration(3_600_000)).toBe('1:00:00');
    expect(formatDuration(3_725_000)).toBe('1:02:05');
  });

  it('redondea los milisegundos al segundo más cercano', () => {
    expect(formatDuration(1_499)).toBe('0:01');
    expect(formatDuration(1_500)).toBe('0:02');
  });

  it('un valor negativo no se pinta con signo', () => {
    expect(formatDuration(-4_000)).toBe('0:00');
  });
});

describe('roundedPercent', () => {
  it('redondea y quita el signo: eso lo dice el texto', () => {
    expect(roundedPercent(-22.4)).toBe(22);
    expect(roundedPercent(7.6)).toBe(8);
  });
});

describe('trend', () => {
  it('subir el acierto es mejorar', () => {
    expect(trend(12)).toBe('better');
    expect(trend(-12)).toBe('worse');
  });

  it('bajar el tiempo es mejorar', () => {
    expect(trend(-18, true)).toBe('better');
    expect(trend(18, true)).toBe('worse');
  });

  it('un cambio que se ve como 0 no es ni mejor ni peor', () => {
    expect(trend(0.3)).toBe('same');
    expect(trend(-0.4, true)).toBe('same');
  });
});
