import { serializeFirestoreData } from '@services/firestore/firestore-serialize.util';

describe('serializeFirestoreData', () => {
  afterEach(() => jest.restoreAllMocks());

  it('devuelve una copia profunda: modificarla no altera el original', () => {
    const original = { title: 'a', blocks: [{ theme: 'fork' }] };

    const copy = serializeFirestoreData<typeof original>(original);
    copy.blocks[0].theme = 'pin';

    expect(copy).not.toBe(original);
    expect(original.blocks[0].theme).toBe('fork');
  });

  it('quita los prototipos: el resultado es un objeto plano', () => {
    class Doc {
      uid = 'x';
    }

    const copy = serializeFirestoreData<{ uid: string }>(new Doc());

    expect(Object.getPrototypeOf(copy)).toBe(Object.prototype);
    expect(copy).toEqual({ uid: 'x' });
  });

  it('descarta las propiedades undefined y funciones, como JSON', () => {
    const copy = serializeFirestoreData<Record<string, unknown>>({
      a: 1,
      b: undefined,
      c: () => 1,
    });

    expect(copy).toEqual({ a: 1 });
  });

  it('conserva null y valores primitivos', () => {
    expect(serializeFirestoreData(null)).toBeNull();
    expect(serializeFirestoreData<number>(5)).toBe(5);
    expect(serializeFirestoreData<string>('hola')).toBe('hola');
  });

  describe('cuando JSON no puede serializar (referencia circular)', () => {
    beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => undefined));

    it('registra el error y devuelve una copia manual con los datos serializables', () => {
      const circular: Record<string, unknown> = { uid: 'p1', stats: { likes: 2 } };
      circular['self'] = circular;

      const copy = serializeFirestoreData<Record<string, unknown>>(circular);

      expect(console.error).toHaveBeenCalled();
      expect(copy['uid']).toBe('p1');
      expect(copy['stats']).toEqual({ likes: 2 });
      expect(copy).not.toBe(circular);
    });

    it('copia arreglos elemento a elemento', () => {
      const circular: Record<string, unknown> = { items: [{ n: 1 }, { n: 2 }] };
      circular['self'] = circular;

      const copy = serializeFirestoreData<{ items: Array<{ n: number }> }>(circular);

      expect(copy.items).toEqual([{ n: 1 }, { n: 2 }]);
      expect(copy.items[0]).not.toBe((circular['items'] as unknown[])[0]);
    });
  });
});
