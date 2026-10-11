import { TestBed } from '@angular/core/testing';

import { ChessGame } from '@chesspark/models';
import { ChessComUserNotFoundError } from '@chesspark/chess-com-provider';
import { LichessUserNotFoundError } from '@chesspark/lichess-provider';
import { AnalyticsService } from '@services/analytics/analytics.service';
import {
  GameAnalyticsService,
  UnknownUsernameError,
} from '@services/analytics/game-analytics.service';

// Dobles de las tres librerías de datos: nada de red ni IndexedDB.
const mockChessCom = {
  platform: 'chess.com',
  userExists: jest.fn(),
  listArchiveMonths: jest.fn(),
};
const mockLichess = { platform: 'lichess', userExists: jest.fn() };
const mockArchive = {
  sync: jest.fn(),
  getStoredGames: jest.fn(),
  getStorageSummary: jest.fn(),
  getStorageByAccount: jest.fn(),
  deleteAccount: jest.fn(),
  clear: jest.fn(),
};

jest.mock('@chesspark/chess-com-provider', () => ({
  ChessComUserNotFoundError: class ChessComUserNotFoundError extends Error {},
  createChessComProvider: () => mockChessCom,
}));
jest.mock('@chesspark/lichess-provider', () => ({
  LichessUserNotFoundError: class LichessUserNotFoundError extends Error {},
  createLichessProvider: () => mockLichess,
}));
jest.mock('@chesspark/game-reporter', () => ({
  createGamesArchive: () => mockArchive,
}));

const SETTINGS_KEY = 'chessColate_game_analytics';
const NOW = new Date(2026, 5, 15, 12, 0, 0); // 15 jun 2026

const game = (id: string, source: 'chess.com' | 'lichess', playedAt: number): ChessGame =>
  ({ id, source, playedAt } as unknown as ChessGame);

describe('GameAnalyticsService', () => {
  let service: GameAnalyticsService;
  let logEvent: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    localStorage.clear();
    Object.values(mockChessCom).forEach((v) => typeof v === 'function' && (v as jest.Mock).mockReset());
    Object.values(mockLichess).forEach((v) => typeof v === 'function' && (v as jest.Mock).mockReset());
    Object.values(mockArchive).forEach((fn) => fn.mockReset());
    mockArchive.sync.mockResolvedValue({ games: [] });
    mockArchive.getStoredGames.mockResolvedValue([]);
    mockArchive.deleteAccount.mockResolvedValue(undefined);
    mockArchive.clear.mockResolvedValue(undefined);
    mockChessCom.listArchiveMonths.mockResolvedValue([]);
    logEvent = jest.fn().mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      providers: [{ provide: AnalyticsService, useValue: { logEvent } }],
    });
    service = TestBed.inject(GameAnalyticsService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('ajustes', () => {
    it('sin nada guardado devuelve los de fábrica (sin cuentas, 6 meses)', () => {
      expect(service.getSettings()).toEqual({
        accounts: { chesscom: '', lichess: '' },
        historyMonths: 6,
      });
    });

    it('los valores por defecto devueltos no se comparten entre llamadas', () => {
      service.getSettings().accounts.chesscom = 'mutado';

      expect(service.getSettings().accounts.chesscom).toBe('');
    });

    it('completa con valores por defecto las cuentas que faltan en lo guardado', () => {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({ historyMonths: 12, accounts: { lichess: 'magnus' } })
      );

      expect(service.getSettings()).toEqual({
        accounts: { chesscom: '', lichess: 'magnus' },
        historyMonths: 12,
      });
    });

    it('con JSON corrupto vuelve a los valores de fábrica y avisa por consola', () => {
      const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      localStorage.setItem(SETTINGS_KEY, '{roto');

      expect(service.getSettings().historyMonths).toBe(6);
      expect(error).toHaveBeenCalled();
    });

    it('saveSettings fusiona el parche con lo guardado, lo persiste y lo devuelve', () => {
      service.saveSettings({ historyMonths: 24 });

      const result = service.saveSettings({
        accounts: { chesscom: 'hikaru', lichess: '' },
      });

      expect(result).toEqual({
        accounts: { chesscom: 'hikaru', lichess: '' },
        historyMonths: 24,
      });
      expect(JSON.parse(localStorage.getItem(SETTINGS_KEY) as string)).toEqual(result);
    });

    it('si localStorage falla al guardar, igual devuelve los ajustes sin lanzar', () => {
      const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('cuota');
      });

      const result = service.saveSettings({ historyMonths: 3 });

      expect(result.historyMonths).toBe(3);
      expect(error).toHaveBeenCalled();
    });
  });

  describe('verifyUsername', () => {
    it('un nombre vacío o de espacios es falso y no consulta la red', async () => {
      await expect(service.verifyUsername('chess.com', '   ')).resolves.toBe(false);

      expect(mockChessCom.userExists).not.toHaveBeenCalled();
      expect(mockLichess.userExists).not.toHaveBeenCalled();
    });

    it('en chess.com consulta ese proveedor con el nombre recortado', async () => {
      mockChessCom.userExists.mockResolvedValue(true);

      await expect(service.verifyUsername('chess.com', ' hikaru ')).resolves.toBe(true);

      expect(mockChessCom.userExists).toHaveBeenCalledWith('hikaru');
      expect(mockLichess.userExists).not.toHaveBeenCalled();
    });

    it('en lichess consulta ese proveedor y respeta que no exista', async () => {
      mockLichess.userExists.mockResolvedValue(false);

      await expect(service.verifyUsername('lichess', 'nadie')).resolves.toBe(false);

      expect(mockLichess.userExists).toHaveBeenCalledWith('nadie');
      expect(mockChessCom.userExists).not.toHaveBeenCalled();
    });

    it('si falla la red lo deja pasar (true) en vez de decir que no existe', async () => {
      jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      mockChessCom.userExists.mockRejectedValue(new Error('offline'));

      await expect(service.verifyUsername('chess.com', 'hikaru')).resolves.toBe(true);
    });
  });

  describe('sync', () => {
    const none = { chesscom: '', lichess: '' };

    it('sin cuentas conectadas no descarga nada y devuelve lista vacía', async () => {
      const games = await service.sync(none, 6);

      expect(games).toEqual([]);
      expect(mockArchive.sync).not.toHaveBeenCalled();
    });

    it('en chess.com solo pide los meses del rango que la plataforma dice tener con partidas', async () => {
      // Rango de 3 meses con "now" = jun 2026: abr, may, jun
      mockChessCom.listArchiveMonths.mockResolvedValue([
        { year: 2026, month: 6 },
        { year: 2026, month: 4 },
        { year: 2020, month: 1 },
      ]);

      await service.sync({ chesscom: ' hikaru ', lichess: '' }, 3);

      const [source, username, months] = mockArchive.sync.mock.calls[0];
      expect(source).toBe(mockChessCom);
      expect(username).toBe('hikaru');
      expect(months.map((m: { year: number; month: number }) => `${m.year}-${m.month}`)).toEqual([
        '2026-4',
        '2026-6',
      ]);
    });

    it('en lichess pide todos los meses del rango sin listar archivo', async () => {
      await service.sync({ chesscom: '', lichess: 'magnus' }, 3);

      const [source, username, months] = mockArchive.sync.mock.calls[0];
      expect(source).toBe(mockLichess);
      expect(username).toBe('magnus');
      expect(months).toHaveLength(3);
      expect(mockChessCom.listArchiveMonths).not.toHaveBeenCalled();
    });

    it('junta las partidas de las dos plataformas ordenadas por fecha y las deja en memoria', async () => {
      const a = game('a', 'chess.com', 300);
      const b = game('b', 'chess.com', 100);
      const c = game('c', 'lichess', 200);
      mockArchive.sync
        .mockResolvedValueOnce({ games: [a, b] })
        .mockResolvedValueOnce({ games: [c] });

      const result = await service.sync({ chesscom: 'x', lichess: 'y' }, 3);

      expect(result.map((g) => g.id)).toEqual(['b', 'c', 'a']);
      expect(service.currentGames).toBe(result);
    });

    it('reenvía el callback de progreso al archivo', async () => {
      const onProgress = jest.fn();

      await service.sync({ chesscom: '', lichess: 'y' }, 3, onProgress);

      expect(mockArchive.sync.mock.calls[0][3]).toBe(onProgress);
    });

    it('si chess.com no conoce al usuario lanza UnknownUsernameError y no descarga', async () => {
      mockChessCom.listArchiveMonths.mockRejectedValue(new ChessComUserNotFoundError('fantasma'));

      const attempt = service.sync({ chesscom: 'fantasma', lichess: '' }, 3);

      await expect(attempt).rejects.toBeInstanceOf(UnknownUsernameError);
      await expect(attempt).rejects.toMatchObject({ platform: 'chess.com' });
      expect(mockArchive.sync).not.toHaveBeenCalled();
    });

    it('si listar el archivo de chess.com falla por otra causa, intenta con todos los meses del rango', async () => {
      jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      mockChessCom.listArchiveMonths.mockRejectedValue(new Error('timeout'));

      await service.sync({ chesscom: 'hikaru', lichess: '' }, 3);

      expect(mockArchive.sync.mock.calls[0][2]).toHaveLength(3);
    });

    it('si lichess no conoce al usuario lanza UnknownUsernameError de lichess', async () => {
      mockArchive.sync.mockRejectedValue(new LichessUserNotFoundError('fantasma'));

      await expect(service.sync({ chesscom: '', lichess: 'fantasma' }, 3)).rejects.toMatchObject({
        name: 'UnknownUsernameError',
        platform: 'lichess',
      });
    });

    it('un error cualquiera del archivo se propaga tal cual', async () => {
      const boom = new Error('IndexedDB lleno');
      mockArchive.sync.mockRejectedValue(boom);

      await expect(service.sync({ chesscom: '', lichess: 'y' }, 3)).rejects.toBe(boom);
    });

    it('registra la analítica con plataformas, meses y número de partidas', async () => {
      mockArchive.sync
        .mockResolvedValueOnce({ games: [game('a', 'chess.com', 1)] })
        .mockResolvedValueOnce({ games: [game('b', 'lichess', 2), game('c', 'lichess', 3)] });
      mockChessCom.listArchiveMonths.mockResolvedValue([{ year: 2026, month: 6 }]);

      await service.sync({ chesscom: 'x', lichess: 'y' }, 6);

      expect(logEvent).toHaveBeenCalledWith('game_analytics_synced', {
        platforms: 'chesscom+lichess',
        months: 6,
        games_count: 3,
      });
    });

    it('la analítica nombra solo la plataforma conectada', async () => {
      await service.sync({ chesscom: '', lichess: 'y' }, 3);

      expect(logEvent).toHaveBeenCalledWith(
        'game_analytics_synced',
        expect.objectContaining({ platforms: 'lichess' })
      );
    });
  });

  describe('loadStored', () => {
    it('lee de cada cuenta conectada con el nombre recortado, sin tocar la red', async () => {
      await service.loadStored({ chesscom: ' hikaru ', lichess: 'magnus' }, 6);

      expect(mockArchive.getStoredGames).toHaveBeenCalledWith('chess.com', 'hikaru');
      expect(mockArchive.getStoredGames).toHaveBeenCalledWith('lichess', 'magnus');
      expect(mockArchive.sync).not.toHaveBeenCalled();
    });

    it('no consulta cuentas no conectadas', async () => {
      await service.loadStored({ chesscom: '', lichess: '' }, 6);

      expect(mockArchive.getStoredGames).not.toHaveBeenCalled();
    });

    it('descarta lo que cae fuera del rango elegido y ordena por fecha', async () => {
      const recent = new Date(2026, 5, 1).getTime();
      const middle = new Date(2026, 4, 1).getTime();
      const old = new Date(2024, 0, 1).getTime();
      mockArchive.getStoredGames.mockResolvedValue([
        game('reciente', 'chess.com', recent),
        game('viejo', 'chess.com', old),
        game('medio', 'chess.com', middle),
      ]);

      const result = await service.loadStored({ chesscom: 'x', lichess: '' }, 3);

      expect(result.map((g) => g.id)).toEqual(['medio', 'reciente']);
      expect(service.currentGames).toBe(result);
    });
  });

  describe('almacenamiento', () => {
    it('getStorageSummary y getStorageByAccount delegan en el archivo', async () => {
      const summary = { games: 3 };
      const byAccount = [{ username: 'x' }];
      mockArchive.getStorageSummary.mockResolvedValue(summary);
      mockArchive.getStorageByAccount.mockResolvedValue(byAccount);

      await expect(service.getStorageSummary()).resolves.toBe(summary);
      await expect(service.getStorageByAccount()).resolves.toBe(byAccount);
    });

    it('clearArchive vacía el archivo y la memoria', async () => {
      mockArchive.getStoredGames.mockResolvedValue([game('a', 'chess.com', Date.now())]);
      await service.loadStored({ chesscom: 'x', lichess: '' }, 6);
      expect(service.currentGames).toHaveLength(1);

      await service.clearArchive();

      expect(mockArchive.clear).toHaveBeenCalled();
      expect(service.currentGames).toEqual([]);
    });
  });

  describe('disconnect', () => {
    beforeEach(async () => {
      service.saveSettings({ accounts: { chesscom: 'hikaru', lichess: 'magnus' } });
      mockArchive.getStoredGames
        .mockResolvedValueOnce([game('cc', 'chess.com', Date.now())])
        .mockResolvedValueOnce([game('li', 'lichess', Date.now())]);
      await service.loadStored({ chesscom: 'hikaru', lichess: 'magnus' }, 6);
    });

    it('borra las partidas de chess.com, vacía solo esa cuenta de los ajustes y lo persiste', async () => {
      const result = await service.disconnect('chess.com', 'hikaru');

      expect(mockArchive.deleteAccount).toHaveBeenCalledWith('chess.com', 'hikaru');
      expect(service.currentGames.map((g) => g.id)).toEqual(['li']);
      expect(result.accounts).toEqual({ chesscom: '', lichess: 'magnus' });
      expect(service.getSettings().accounts).toEqual({ chesscom: '', lichess: 'magnus' });
    });

    it('al desconectar lichess conserva chess.com', async () => {
      const result = await service.disconnect('lichess', 'magnus');

      expect(service.currentGames.map((g) => g.id)).toEqual(['cc']);
      expect(result.accounts).toEqual({ chesscom: 'hikaru', lichess: '' });
    });

    it('registra la analítica con el nombre corto de la plataforma', async () => {
      await service.disconnect('chess.com', 'hikaru');
      await service.disconnect('lichess', 'magnus');

      expect(logEvent).toHaveBeenCalledWith('game_analytics_disconnected', { platform: 'chesscom' });
      expect(logEvent).toHaveBeenCalledWith('game_analytics_disconnected', { platform: 'lichess' });
    });

    it('si borrar el archivo falla, no toca ajustes ni memoria', async () => {
      mockArchive.deleteAccount.mockRejectedValue(new Error('fallo'));

      await expect(service.disconnect('chess.com', 'hikaru')).rejects.toThrow('fallo');

      expect(service.getSettings().accounts.chesscom).toBe('hikaru');
      expect(service.currentGames).toHaveLength(2);
    });
  });
});
