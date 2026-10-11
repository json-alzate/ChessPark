import { TestBed } from '@angular/core/testing';
import { getApp } from 'firebase/app';
import { getFirestore, initializeFirestore } from 'firebase/firestore';

import { FirestoreConnection } from '@core/firestore/firestore-connection.service';

jest.mock('firebase/app', () => ({ getApp: jest.fn() }));
jest.mock('firebase/firestore', () => ({
  initializeFirestore: jest.fn(),
  getFirestore: jest.fn(),
}));

describe('FirestoreConnection', () => {
  const app = { name: 'app' };
  const db = { name: 'db' };
  let connection: FirestoreConnection;

  beforeEach(() => {
    jest.clearAllMocks();
    (getApp as jest.Mock).mockReturnValue(app);
    (getFirestore as jest.Mock).mockReturnValue(db);
    TestBed.configureTestingModule({});
    connection = TestBed.inject(FirestoreConnection);
  });

  it('antes de init() no hay instancia de Firestore', () => {
    expect(connection.db).toBeUndefined();
  });

  it('init() inicia Firestore con useFetchStreams desactivado sobre la app por defecto', async () => {
    await connection.init();

    expect(initializeFirestore).toHaveBeenCalledWith(app, { useFetchStreams: false });
  });

  it('init() deja disponible la instancia que devuelve getFirestore', async () => {
    await connection.init();

    expect(getFirestore).toHaveBeenCalledWith(app);
    expect(connection.db).toBe(db);
  });

  it('inicializa antes de pedir la instancia (el orden importa para aplicar los ajustes)', async () => {
    const order: string[] = [];
    (initializeFirestore as jest.Mock).mockImplementation(() => order.push('initialize'));
    (getFirestore as jest.Mock).mockImplementation(() => {
      order.push('get');
      return db;
    });

    await connection.init();

    expect(order).toEqual(['initialize', 'get']);
  });

  it('es un singleton: todos los repositorios reciben la misma conexión', async () => {
    expect(TestBed.inject(FirestoreConnection)).toBe(connection);
  });
});
