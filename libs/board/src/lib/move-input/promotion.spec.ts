import { isPromotionAttempt } from './promotion';

describe('isPromotionAttempt', () => {
  it('un peón blanco que llega a la fila 8 es una coronación', () => {
    expect(isPromotionAttempt('wp', 'a8')).toBe(true);
  });

  it('un peón negro que llega a la fila 1 es una coronación', () => {
    expect(isPromotionAttempt('bp', 'h1')).toBe(true);
  });

  it('un peón que llega a cualquier otra fila no lo es', () => {
    expect(isPromotionAttempt('wp', 'a7')).toBe(false);
    expect(isPromotionAttempt('bp', 'e2')).toBe(false);
  });

  it('una pieza que no es peón no corona aunque llegue a la última fila', () => {
    expect(isPromotionAttempt('wr', 'a8')).toBe(false);
    expect(isPromotionAttempt('bk', 'e1')).toBe(false);
  });
});
