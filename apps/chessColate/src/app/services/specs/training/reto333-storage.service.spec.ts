import { Reto333StorageService, Reto333Attempt } from '../../training/reto333-storage.service';

const KEY = 'chesscolate_reto333_stats';

const attempt: Reto333Attempt = {
  score: 40,
  maxElo: 800,
  timeSeconds: 600,
  timeString: '10m 0s',
  completed: false,
};

describe('Reto333StorageService', () => {
  let service: Reto333StorageService;

  beforeEach(() => {
    localStorage.clear();
    service = new Reto333StorageService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('devuelve null con localStorage vacío', () => {
    expect(service.getRecord()).toBeNull();
  });

  it('devuelve null sin lanzar y avisa por consola con JSON corrupto', () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    localStorage.setItem(KEY, '{corrupto');

    expect(service.getRecord()).toBeNull();
    expect(consoleError).toHaveBeenCalled();
  });

  it('rellena con valores por defecto los campos que faltan en marcas antiguas', () => {
    localStorage.setItem(KEY, JSON.stringify({ lastScore: 12 }));

    expect(service.getRecord()).toEqual({
      uidUser: undefined,
      lastScore: 12,
      bestScore: 0,
      maxElo: 0,
      lastTime: 0,
      timeString: '',
      completed: false,
      lastPlayedAt: 0,
    });
  });

  it('saveAttempt conserva la mejor marca entre intentos', () => {
    service.saveAttempt({ ...attempt, score: 50 }, 'user-1');
    const record = service.saveAttempt({ ...attempt, score: 20 }, 'user-1');

    expect(record.lastScore).toBe(20);
    expect(record.bestScore).toBe(50);
    expect(service.getRecord()?.bestScore).toBe(50);
  });

  it('saveAttempt sin uid conserva el dueño anterior de la marca', () => {
    service.saveAttempt(attempt, 'user-1');
    const record = service.saveAttempt(attempt);

    expect(record.uidUser).toBe('user-1');
  });

  it('clear borra la marca', () => {
    service.saveAttempt(attempt);
    service.clear();

    expect(service.getRecord()).toBeNull();
  });
});
