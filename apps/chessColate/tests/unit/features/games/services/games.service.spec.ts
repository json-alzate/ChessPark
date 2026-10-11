import { TestBed } from '@angular/core/testing';

import { Capacitor } from '@capacitor/core';
import { KeepAwake } from '@capacitor-community/keep-awake';

import { GameCollectionInfo, GameHeader } from '@chesspark/games-provider';
import { ChessGame } from '@chesspark/models';

import { AnalyticsService } from '@services/analytics/analytics.service';
import { GamesService } from '@features/games/services/games.service';
import { DEFAULT_PLAYBACK_SETTINGS } from '@features/games/utils/games.util';

import { makePgn } from '@tests/support/partidas-progreso-fixtures';

/** Doble del proveedor: solo se sustituye la fábrica, el parser de PGN es el real. */
const mockProvider = {
  getCatalog: jest.fn(),
  getCollection: jest.fn(),
  getDownloadedIds: jest.fn(),
  isDownloaded: jest.fn(),
  downloadPack: jest.fn(),
  deletePack: jest.fn(),
  getStorageSummary: jest.fn(),
  clearAllPacks: jest.fn(),
  getPackPgn: jest.fn(),
};

jest.mock('@chesspark/games-provider', () => ({
  ...jest.requireActual('@chesspark/games-provider'),
  createGamesProvider: () => mockProvider,
}));

jest.mock('@capacitor-community/keep-awake', () => ({
  KeepAwake: {
    keepAwake: jest.fn().mockResolvedValue(undefined),
    allowSleep: jest.fn().mockResolvedValue(undefined),
  },
}));

const SETTINGS_KEY = 'chessColate_games_playback';

const collection = (id: string, games = 2): GameCollectionInfo => ({
  id,
  name: `Jugador ${id}`,
  reign: '1960–1970',
  games,
  sizeBytes: 10 * 1024,
  file: `players/${id}.pgn`,
});

/** Un paquete con dos partidas distintas. */
const twoGamesPgn = () =>
  makePgn('Petrosian', 'Spassky') + '\n' + makePgn('Fischer', 'Taimanov');

describe('GamesService', () => {
  let service: GamesService;
  const analytics = { logEvent: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    jest.resetAllMocks();
    analytics.logEvent.mockResolvedValue(undefined);
    (KeepAwake.keepAwake as jest.Mock).mockResolvedValue(undefined);
    (KeepAwake.allowSleep as jest.Mock).mockResolvedValue(undefined);
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        GamesService,
        { provide: AnalyticsService, useValue: analytics },
      ],
    });
    service = TestBed.inject(GamesService);
  });

  describe('catálogo y descargas', () => {
    it('getDownloadedCollections cruza los ids descargados con el catálogo', async () => {
      mockProvider.getDownloadedIds.mockResolvedValue(['fischer', 'desconocido']);
      mockProvider.getCatalog.mockResolvedValue([
        collection('petrosian'),
        collection('fischer'),
      ]);

      const result = await service.getDownloadedCollections();

      expect(result.map((c) => c.id)).toEqual(['fischer']);
    });

    it('download avisa del avance, delega en el proveedor y registra el evento con el tamaño en KB', async () => {
      mockProvider.downloadPack.mockResolvedValue(undefined);
      const onProgress = jest.fn();
      const info = collection('fischer', 800);

      await service.download(info, onProgress);

      expect(mockProvider.downloadPack).toHaveBeenCalledWith(info, onProgress);
      expect(analytics.logEvent).toHaveBeenCalledWith('games_pack_downloaded', {
        player: 'fischer',
        games: 800,
        size_kb: 10,
      });
    });

    it('si la descarga falla propaga el error y no registra el evento', async () => {
      mockProvider.downloadPack.mockRejectedValue(new Error('sin red'));

      await expect(service.download(collection('fischer'))).rejects.toThrow('sin red');
      expect(analytics.logEvent).not.toHaveBeenCalled();
    });

    it('deletePack borra en el proveedor y registra el evento', async () => {
      mockProvider.deletePack.mockResolvedValue(undefined);

      await service.deletePack('fischer');

      expect(mockProvider.deletePack).toHaveBeenCalledWith('fischer');
      expect(analytics.logEvent).toHaveBeenCalledWith('games_pack_deleted', {
        player: 'fischer',
      });
    });
  });

  describe('paquete abierto', () => {
    it('openCollection descarga/lee el PGN, extrae las cabeceras y deja el paquete como actual', async () => {
      mockProvider.getPackPgn.mockResolvedValue(twoGamesPgn());
      const info = collection('petrosian');
      const onProgress = jest.fn();

      const pack = await service.openCollection(info, onProgress);

      expect(mockProvider.getPackPgn).toHaveBeenCalledWith(info, onProgress);
      expect(pack.headers.map((h) => h.white)).toEqual(['Petrosian', 'Fischer']);
      expect(pack.games).toHaveLength(2);
      expect(service.currentPack).toBe(pack);
    });

    it('openCollection reutiliza el paquete ya abierto de la misma colección sin volver a leer', async () => {
      mockProvider.getPackPgn.mockResolvedValue(twoGamesPgn());
      const info = collection('petrosian');

      const first = await service.openCollection(info);
      const second = await service.openCollection(info);

      expect(second).toBe(first);
      expect(mockProvider.getPackPgn).toHaveBeenCalledTimes(1);
    });

    it('openCollection de otra colección reemplaza el paquete abierto', async () => {
      mockProvider.getPackPgn
        .mockResolvedValueOnce(makePgn('A', 'B'))
        .mockResolvedValueOnce(makePgn('C', 'D'));

      await service.openCollection(collection('uno'));
      const other = await service.openCollection(collection('dos'));

      expect(mockProvider.getPackPgn).toHaveBeenCalledTimes(2);
      expect(service.currentPack).toBe(other);
      expect(other.headers[0].white).toBe('C');
    });

    it('si getPackPgn falla, propaga el error y no deja paquete a medias', async () => {
      mockProvider.getPackPgn.mockRejectedValue(new Error('descarga rota'));

      await expect(service.openCollection(collection('x'))).rejects.toThrow('descarga rota');
      expect(service.currentPack).toBeNull();
    });

    it('deletePack cierra el paquete si era el que estaba abierto', async () => {
      mockProvider.getPackPgn.mockResolvedValue(makePgn('A', 'B'));
      mockProvider.deletePack.mockResolvedValue(undefined);
      await service.openCollection(collection('petrosian'));

      await service.deletePack('petrosian');

      expect(service.currentPack).toBeNull();
    });

    it('deletePack de otra colección deja intacto el paquete abierto', async () => {
      mockProvider.getPackPgn.mockResolvedValue(makePgn('A', 'B'));
      mockProvider.deletePack.mockResolvedValue(undefined);
      await service.openCollection(collection('petrosian'));

      await service.deletePack('fischer');

      expect(service.currentPack?.collection.id).toBe('petrosian');
    });

    it('clearGamePacks vacía el proveedor y cierra el paquete abierto', async () => {
      mockProvider.getPackPgn.mockResolvedValue(makePgn('A', 'B'));
      mockProvider.clearAllPacks.mockResolvedValue(undefined);
      await service.openCollection(collection('petrosian'));

      await service.clearGamePacks();

      expect(mockProvider.clearAllPacks).toHaveBeenCalled();
      expect(service.currentPack).toBeNull();
    });
  });

  describe('getGame y getGamePgn', () => {
    beforeEach(async () => {
      mockProvider.getPackPgn.mockResolvedValue(twoGamesPgn());
      await service.openCollection(collection('petrosian'));
    });

    it('getGame deriva las posiciones de la partida pedida', () => {
      const game = service.getGame(1);

      expect(game?.header.white).toBe('Fischer');
      expect(game?.sanMoves).toEqual(['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7#']);
      expect(game?.fens).toHaveLength(game!.sanMoves.length + 1);
    });

    it.each([-1, 2, 99])('getGame devuelve null con el índice fuera de rango (%s)', (index) => {
      expect(service.getGame(index)).toBeNull();
    });

    it('getGame devuelve null si el PGN de esa partida no se deja leer', async () => {
      mockProvider.getPackPgn.mockResolvedValue(
        makePgn('A', 'B', '', '1. e4 e5 2. Zz9 *')
      );
      await service.openCollection(collection('rota'));

      expect(service.getGame(0)).toBeNull();
    });

    it('getGamePgn devuelve el texto tal cual de la partida', () => {
      const pgn = service.getGamePgn(0);

      expect(pgn).toContain('[White "Petrosian"]');
      expect(pgn).not.toContain('Fischer');
    });

    it.each([-1, 2])('getGamePgn devuelve null con el índice fuera de rango (%s)', (index) => {
      expect(service.getGamePgn(index)).toBeNull();
    });

    it('sin paquete abierto, getGame y getGamePgn devuelven null', async () => {
      mockProvider.clearAllPacks.mockResolvedValue(undefined);
      await service.clearGamePacks();

      expect(service.getGame(0)).toBeNull();
      expect(service.getGamePgn(0)).toBeNull();
    });
  });

  describe('openUserPgn', () => {
    it('abre un paquete sin id con el título dado y el nº de partidas leídas', () => {
      const pack = service.openUserPgn(twoGamesPgn(), 'Mis partidas');

      expect(pack).not.toBeNull();
      expect(pack!.collection).toMatchObject({ id: '', name: 'Mis partidas', games: 2 });
      expect(service.currentPack).toBe(pack);
    });

    it('si el texto no trae ninguna partida devuelve null, registra el fallo y no toca el paquete abierto', async () => {
      mockProvider.getPackPgn.mockResolvedValue(makePgn('A', 'B'));
      await service.openCollection(collection('petrosian'));

      const pack = service.openUserPgn('esto no es un pgn', 'Roto');

      expect(pack).toBeNull();
      expect(analytics.logEvent).toHaveBeenCalledWith('games_pgn_load_failed', {
        reason: 'no_games',
      });
      expect(service.currentPack?.collection.id).toBe('petrosian');
    });
  });

  describe('openOwnGames', () => {
    const ownGame = (id: string, pgn: string, overrides: Partial<ChessGame> = {}): ChessGame =>
      ({
        id,
        source: 'lichess',
        pgn,
        timeControl: '600+0',
        timeControlSeconds: 600,
        incrementSeconds: 0,
        timeClass: 'rapid',
        playedAt: 0,
        white: { username: 'yo', rating: 1500 },
        black: { username: 'rival', rating: 1500 },
        result: 'win',
        userColor: 'white',
        variant: 'standard',
        analyzed: false,
        ...overrides,
      } as ChessGame);

    it('respeta el orden de la lista y toma el ritmo del propio ChessGame, no del PGN', () => {
      const games = [
        ownGame('1', makePgn('yo', 'rival', '[TimeControl "60+0"]'), {
          timeControl: '180+2',
          timeClass: 'blitz',
        }),
        ownGame('2', makePgn('rival2', 'yo'), { timeControl: '', timeClass: 'rapid' }),
      ];

      const pack = service.openOwnGames('Mis partidas', games);

      expect(pack.collection).toMatchObject({ id: '', name: 'Mis partidas', games: 2 });
      expect(pack.games).toEqual([games[0].pgn, games[1].pgn]);
      const headers: GameHeader[] = pack.headers;
      expect(headers.map((h) => h.index)).toEqual([0, 1]);
      expect(headers[0]).toMatchObject({ white: 'yo', timeControl: '180+2', timeClass: 'blitz' });
      // Un ChessGame sin timeControl queda como null, no como cadena vacía
      expect(headers[1].timeControl).toBeNull();
      expect(service.currentPack).toBe(pack);
    });

    it('con una lista vacía abre un paquete de 0 partidas (sin devolver null)', () => {
      const pack = service.openOwnGames('Vacío', []);

      expect(pack.collection.games).toBe(0);
      expect(pack.headers).toEqual([]);
    });
  });

  describe('ajustes de reproducción', () => {
    it('sin nada guardado devuelve los valores por defecto (copia, no la constante)', () => {
      const settings = service.getSettings();

      expect(settings).toEqual(DEFAULT_PLAYBACK_SETTINGS);
      expect(settings).not.toBe(DEFAULT_PLAYBACK_SETTINGS);
    });

    it('saveSettings fusiona el parche, lo persiste y lo devuelve', () => {
      const saved = service.saveSettings({ msPerMove: 500, shuffle: true });

      expect(saved).toEqual({ ...DEFAULT_PLAYBACK_SETTINGS, msPerMove: 500, shuffle: true });
      expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!)).toEqual(saved);
      expect(service.getSettings()).toEqual(saved);
    });

    it('parches sucesivos se acumulan sin perder lo anterior', () => {
      service.saveSettings({ msPerMove: 500 });
      service.saveSettings({ soundEnabled: false });

      expect(service.getSettings()).toMatchObject({ msPerMove: 500, soundEnabled: false });
    });

    it('rellena con los valores por defecto los campos que faltan en versiones antiguas', () => {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ msPerMove: 750 }));

      expect(service.getSettings()).toEqual({ ...DEFAULT_PLAYBACK_SETTINGS, msPerMove: 750 });
    });

    it('con JSON corrupto devuelve los valores por defecto sin lanzar', () => {
      const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      localStorage.setItem(SETTINGS_KEY, '{corrupto');

      expect(service.getSettings()).toEqual(DEFAULT_PLAYBACK_SETTINGS);
      expect(error).toHaveBeenCalled();
      error.mockRestore();
    });

    it('si localStorage falla al guardar, devuelve igualmente los ajustes resultantes', () => {
      const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const setItem = jest
        .spyOn(Storage.prototype, 'setItem')
        .mockImplementation(() => {
          throw new Error('cuota llena');
        });

      const saved = service.saveSettings({ loopCollection: false });

      expect(saved.loopCollection).toBe(false);
      expect(error).toHaveBeenCalled();
      setItem.mockRestore();
      error.mockRestore();
    });
  });

  describe('keepScreenAwake', () => {
    let isNative: jest.SpyInstance;

    beforeEach(() => {
      isNative = jest.spyOn(Capacitor, 'isNativePlatform');
    });

    afterEach(() => isNative.mockRestore());

    it('en web no toca el plugin', async () => {
      isNative.mockReturnValue(false);

      await service.keepScreenAwake(true);

      expect(KeepAwake.keepAwake).not.toHaveBeenCalled();
      expect(KeepAwake.allowSleep).not.toHaveBeenCalled();
    });

    it('en nativo, true mantiene la pantalla encendida', async () => {
      isNative.mockReturnValue(true);

      await service.keepScreenAwake(true);

      expect(KeepAwake.keepAwake).toHaveBeenCalledTimes(1);
      expect(KeepAwake.allowSleep).not.toHaveBeenCalled();
    });

    it('en nativo, false permite que la pantalla se apague', async () => {
      isNative.mockReturnValue(true);

      await service.keepScreenAwake(false);

      expect(KeepAwake.allowSleep).toHaveBeenCalledTimes(1);
      expect(KeepAwake.keepAwake).not.toHaveBeenCalled();
    });

    it('si el plugin falla no propaga el error', async () => {
      isNative.mockReturnValue(true);
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      (KeepAwake.keepAwake as jest.Mock).mockRejectedValue(new Error('no soportado'));

      await expect(service.keepScreenAwake(true)).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });
});
