import { toLocalISODate } from '@shared/utils/date.util';

describe('toLocalISODate', () => {
  it('rellena con ceros mes y día', () => {
    expect(toLocalISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('usa la fecha local, no la UTC', () => {
    expect(toLocalISODate(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });
});
