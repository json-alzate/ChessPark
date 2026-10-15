import { WoodpeckerStorageService } from '@features/woodpecker/services/woodpecker-storage.service';
import {
  conjunto,
  ejercicios,
  resultado,
  vuelta,
} from '@tests/support/pajaro-carpintero';

const SET_KEY = 'chessColate_woodpecker_set';
const PROGRESS_KEY = 'chessColate_woodpecker_progress';

describe('WoodpeckerStorageService', () => {
  let service: WoodpeckerStorageService;
  const set = conjunto(ejercicios(5));

  beforeEach(() => {
    localStorage.clear();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    service = new WoodpeckerStorageService();
  });

  afterEach(() => jest.restoreAllMocks());

  it('sin nada guardado no hay estado', () => {
    expect(service.getState()).toBeNull();
  });

  it('guardar un set nuevo lo deja con el progreso en blanco', () => {
    expect(service.saveNewSet(set)).toBe(true);

    expect(service.getState()).toEqual({
      set,
      progress: { setId: 'set-1', cycles: [] },
    });
  });

  it('el progreso guardado se recupera junto con el set', () => {
    service.saveNewSet(set);
    const progreso = {
      setId: 'set-1',
      cycles: [vuelta(1, ['p1', 'p2'], [resultado('p1', true)])],
    };

    service.saveProgress(progreso);

    expect(service.getState()?.progress).toEqual(progreso);
  });

  it('un set nuevo borra el progreso del anterior', () => {
    service.saveNewSet(set);
    service.saveProgress({ setId: 'set-1', cycles: [vuelta(1, ['p1'], [resultado('p1', true)])] });

    service.saveNewSet(conjunto(ejercicios(3, 'q'), { id: 'set-2' }));

    expect(service.getState()?.set.id).toBe('set-2');
    expect(service.getState()?.progress).toEqual({ setId: 'set-2', cycles: [] });
  });

  it('un progreso que no es de este set se ignora y se empieza de cero', () => {
    service.saveNewSet(set);
    localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({ setId: 'otro-set', cycles: [vuelta(1, ['x'], [resultado('x', true)])] })
    );

    expect(service.getState()?.progress).toEqual({ setId: 'set-1', cycles: [] });
  });

  it('sin set, un progreso suelto no sirve de nada', () => {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ setId: 'set-1', cycles: [] }));
    expect(service.getState()).toBeNull();
  });

  it('con el set corrupto devuelve null en vez de lanzar', () => {
    localStorage.setItem(SET_KEY, '{corrupto');
    expect(service.getState()).toBeNull();
  });

  it('con un set de forma inválida lo descarta', () => {
    localStorage.setItem(SET_KEY, JSON.stringify({ id: 'x', puzzles: [] }));
    expect(service.getState()).toBeNull();
  });

  it('con el progreso corrupto conserva el set y empieza el progreso de cero', () => {
    service.saveNewSet(set);
    localStorage.setItem(PROGRESS_KEY, '{corrupto');

    expect(service.getState()).toEqual({ set, progress: { setId: 'set-1', cycles: [] } });
  });

  it('un progreso con resultados mal formados se descarta', () => {
    service.saveNewSet(set);
    localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({
        setId: 'set-1',
        cycles: [{ cycle: 1, order: ['p1'], startedAt: 1, results: [{ uidPuzzle: 'p1' }] }],
      })
    );

    expect(service.getState()?.progress.cycles).toEqual([]);
  });

  it('borrar elimina el set y el progreso', () => {
    service.saveNewSet(set);
    service.clear();

    expect(service.getState()).toBeNull();
    expect(localStorage.getItem(SET_KEY)).toBeNull();
    expect(localStorage.getItem(PROGRESS_KEY)).toBeNull();
  });

  describe('si el dispositivo no deja escribir', () => {
    it('un set nuevo devuelve false y conserva el set anterior intacto', () => {
      service.saveNewSet(set);
      service.saveProgress({ setId: 'set-1', cycles: [vuelta(1, ['p1'], [resultado('p1', true)])] });
      const anterior = service.getState();

      // La escritura del set cabe, la del progreso no
      const original = Storage.prototype.setItem;
      jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
        this: Storage,
        key: string,
        value: string
      ) {
        if (key === PROGRESS_KEY) {
          throw new Error('cuota llena');
        }
        return original.call(this, key, value);
      });

      expect(service.saveNewSet(conjunto(ejercicios(3, 'q'), { id: 'set-2' }))).toBe(false);

      jest.restoreAllMocks();
      expect(service.getState()).toEqual(anterior);
    });

    it('guardar el progreso devuelve false sin lanzar', () => {
      service.saveNewSet(set);
      jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('cuota llena');
      });

      expect(service.saveProgress({ setId: 'set-1', cycles: [] })).toBe(false);
    });
  });
});
