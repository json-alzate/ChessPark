/**
 * Doble de `firebase/firestore` para las pruebas de los repositorios.
 *
 * Cada función del SDK devuelve un objeto descriptivo (no hace red), así las
 * pruebas pueden verificar colección, filtros y forma de los datos escritos
 * sin tocar Firebase.
 *
 * Uso en un spec:
 *
 *   jest.mock('firebase/firestore', () =>
 *     jest.requireActual('@tests/support/firestore-plans.fake').createFirestoreMock());
 */

export interface FakeDocRef {
  type: 'doc';
  path: string;
  collection: string;
  id: string;
}

export interface FakeQuery {
  type: 'query';
  collection: string;
  constraints: Array<Record<string, unknown>>;
}

export function createFirestoreMock() {
  const doc = jest.fn(
    (_db: unknown, collection: string, id: string): FakeDocRef => ({
      type: 'doc',
      path: `${collection}/${id}`,
      collection,
      id,
    })
  );
  const collection = jest.fn((_db: unknown, name: string) => ({
    type: 'collection',
    name,
    collection: name,
    constraints: [] as unknown[],
  }));
  const where = jest.fn((field: string, op: string, value: unknown) => ({
    type: 'where',
    field,
    op,
    value,
  }));
  const orderBy = jest.fn((field: string, direction?: string) => ({
    type: 'orderBy',
    field,
    direction,
  }));
  const limit = jest.fn((count: number) => ({ type: 'limit', count }));
  const startAfter = jest.fn((snapshot: unknown) => ({ type: 'startAfter', snapshot }));
  const increment = jest.fn((by: number) => ({ type: 'increment', by }));
  // Acumula restricciones: query(query(col, a), b) => col con [a, b]
  const query = jest.fn(
    (base: { collection: string; constraints: unknown[] }, ...constraints: unknown[]): FakeQuery => ({
      type: 'query',
      collection: base.collection,
      constraints: [...base.constraints, ...constraints] as Array<Record<string, unknown>>,
    })
  );

  return {
    doc,
    collection,
    where,
    orderBy,
    limit,
    startAfter,
    increment,
    query,
    getDoc: jest.fn(),
    getDocs: jest.fn(),
    setDoc: jest.fn(),
    addDoc: jest.fn(),
    updateDoc: jest.fn(),
    getFirestore: jest.fn(),
    initializeFirestore: jest.fn(),
  };
}

/** Snapshot de un documento: `data === undefined` significa que no existe. */
export function fakeDocSnap<T extends object>(id: string, data?: T) {
  return {
    id,
    exists: () => data !== undefined,
    data: () => data,
  };
}

/** Snapshot de una consulta con los documentos indicados, en orden. */
export function fakeQuerySnap<T extends object>(
  docs: Array<{ id: string; data: T }>,
  opciones: { fromCache?: boolean } = {}
) {
  const items = docs.map((d) => ({ id: d.id, data: () => d.data }));
  return {
    docs: items,
    size: items.length,
    metadata: { fromCache: !!opciones.fromCache },
    forEach: (fn: (d: (typeof items)[number]) => void) => items.forEach(fn),
  };
}
