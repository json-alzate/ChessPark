import { CoordinatesPuzzle, StorageService } from '@services/coordinates/storage.service';

const GAMES_KEY = 'chessColate_coordinates_games';
const USER_KEY = 'chessColate_coordinates_user_id';

type NewGame = Omit<CoordinatesPuzzle, 'uid' | 'uidUser'>;

const game = (overrides: Partial<NewGame> = {}): NewGame => ({
  score: 10,
  squaresGood: ['e4', 'd4'],
  squaresBad: ['a1'],
  round: ['e4', 'd4', 'a1'],
  date: 1700000000000,
  color: 'w',
  ...overrides,
});

describe('coordinates StorageService', () => {
  let service: StorageService;

  beforeEach(() => {
    localStorage.clear();
    service = new StorageService();
  });

  afterEach(() => jest.restoreAllMocks());

  describe('usuario', () => {
    it('crea un id de usuario la primera vez y lo conserva en las siguientes', () => {
      const first = service.getCurrentUserId();

      expect(first).toMatch(/^user_\d+_/);
      expect(service.getCurrentUserId()).toBe(first);
      expect(localStorage.getItem(USER_KEY)).toBe(first);
    });

    it('reutiliza el id que ya estaba guardado', () => {
      localStorage.setItem(USER_KEY, 'user_previo');

      expect(service.getCurrentUserId()).toBe('user_previo');
    });
  });

  describe('saveGameResult / getAllGames', () => {
    it('sin partidas devuelve lista vacía', () => {
      expect(service.getAllGames()).toEqual([]);
    });

    it('guarda la partida con uid propio y el id del usuario', () => {
      service.saveGameResult(game({ score: 7 }));

      const [saved] = service.getAllGames();
      expect(saved).toMatchObject({ score: 7, color: 'w', uidUser: service.getCurrentUserId() });
      expect(saved.uid).toMatch(/^game_\d+_/);
    });

    it('acumula partidas con uids distintos', () => {
      service.saveGameResult(game({ score: 1 }));
      service.saveGameResult(game({ score: 2 }));

      const games = service.getAllGames();
      expect(games.map((g) => g.score)).toEqual([1, 2]);
      expect(games[0].uid).not.toBe(games[1].uid);
    });

    it('persiste en la clave esperada de localStorage', () => {
      service.saveGameResult(game());

      expect(JSON.parse(localStorage.getItem(GAMES_KEY) as string)).toHaveLength(1);
    });
  });

  describe('getBestScore', () => {
    it('es 0 sin partidas', () => {
      expect(service.getBestScore()).toBe(0);
    });

    it('devuelve el mayor puntaje', () => {
      [3, 12, 8].forEach((score) => service.saveGameResult(game({ score })));

      expect(service.getBestScore()).toBe(12);
    });
  });

  describe('getUserStats', () => {
    it('sin partidas todo es 0', () => {
      expect(service.getUserStats()).toEqual({
        totalGames: 0,
        bestScore: 0,
        averageScore: 0,
        totalCorrect: 0,
        totalIncorrect: 0,
        accuracy: 0,
      });
    });

    it('calcula totales, promedio y precisión redondeada a 2 decimales', () => {
      service.saveGameResult(game({ score: 10, squaresGood: ['a', 'b'], squaresBad: ['c'] }));
      service.saveGameResult(game({ score: 20, squaresGood: ['a'], squaresBad: [] }));

      // 3 aciertos, 1 fallo => 75 %
      expect(service.getUserStats()).toEqual({
        totalGames: 2,
        bestScore: 20,
        averageScore: 15,
        totalCorrect: 3,
        totalIncorrect: 1,
        accuracy: 75,
      });
    });

    it('redondea la precisión (2 de 3 = 66.67)', () => {
      service.saveGameResult(game({ squaresGood: ['a', 'b'], squaresBad: ['c'] }));

      expect(service.getUserStats().accuracy).toBe(66.67);
    });

    it('partidas sin ningún intento dan precisión 0 y no NaN', () => {
      service.saveGameResult(game({ squaresGood: [], squaresBad: [] }));

      expect(service.getUserStats().accuracy).toBe(0);
    });
  });

  describe('clearUserData', () => {
    it('borra partidas e id de usuario; el siguiente id es nuevo', () => {
      jest.spyOn(Date, 'now').mockReturnValueOnce(111).mockReturnValue(222);
      service.saveGameResult(game());
      const oldId = service.getCurrentUserId();

      service.clearUserData();

      expect(service.getAllGames()).toEqual([]);
      expect(localStorage.getItem(USER_KEY)).toBeNull();
      expect(service.getCurrentUserId()).not.toBe(oldId);
    });
  });

  it('con JSON corrupto en las partidas getAllGames lanza (no hay protección)', () => {
    localStorage.setItem(GAMES_KEY, '{roto');

    expect(() => service.getAllGames()).toThrow();
  });
});
