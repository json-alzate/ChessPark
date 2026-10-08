import { BORDER_TYPE, Chessboard } from 'cm-chessboard';
import {
  buildChessboardConfig,
  CHESSBOARD_ASSETS_URL,
  createChessboard,
  withChessboardAppearance,
} from './create-chessboard';
import {
  resetChessboardAppearanceForTests,
  setChessboardAppearance,
} from '../chessboard-appearance/chessboard-appearance';

// cm-chessboard es un módulo ESM que Jest no carga: se sustituye por un doble que
// guarda con qué se construyó cada tablero.
jest.mock('cm-chessboard', () => ({
  BORDER_TYPE: { none: 'none', thin: 'thin', frame: 'frame' },
  Chessboard: jest.fn().mockImplementation(function (this: unknown, element: unknown, config: unknown) {
    Object.assign(this as object, { element, config });
  }),
}));

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('apariencia elegida por el usuario', () => {
  afterEach(() => resetChessboardAppearanceForTests());

  it('buildChessboardConfig usa el color y las piezas elegidos', () => {
    setChessboardAppearance({ pieces: 'fantasy', board: 'green' });

    const { style } = buildChessboardConfig({ position: START_FEN });

    expect(style?.cssClass).toBe('green');
    expect(style?.pieces?.file).toBe('pieces/fantasy.svg');
  });

  it('withChessboardAppearance reemplaza solo color y piezas de una configuración ya armada', () => {
    setChessboardAppearance({ pieces: 'staunty', board: 'blue' });

    const config = withChessboardAppearance({
      position: START_FEN,
      style: { cssClass: 'chessboard-js', showCoordinates: true, pieces: { file: 'pieces/standard.svg' } },
    });

    expect(config.position).toBe(START_FEN);
    expect(config.style).toEqual({
      cssClass: 'blue',
      showCoordinates: true,
      pieces: { file: 'pieces/staunty.svg' },
    });
  });
});

describe('buildChessboardConfig', () => {
  it('con solo la posición devuelve la configuración común, sin orientation ni extensions', () => {
    expect(buildChessboardConfig({ position: START_FEN })).toEqual({
      responsive: true,
      position: START_FEN,
      assetsUrl: 'assets/cm-chessboard/assets/',
      assetsCache: true,
      style: {
        cssClass: 'chessboard-js',
        borderType: BORDER_TYPE.thin,
        pieces: { file: 'pieces/standard.svg' },
      },
    });
  });

  it('no envía las claves orientation y extensions cuando no se piden', () => {
    const config = buildChessboardConfig({ position: START_FEN });

    // cm-chessboard distingue una clave ausente de una clave con valor undefined
    expect('orientation' in config).toBe(false);
    expect('extensions' in config).toBe(false);
  });

  it('incluye orientation y extensions cuando se piden', () => {
    class Markers {}
    const config = buildChessboardConfig({
      position: START_FEN,
      orientation: 'b',
      extensions: [{ class: Markers }],
    });

    expect(config['orientation']).toBe('b');
    expect(config['extensions']).toEqual([{ class: Markers }]);
  });

  it('usa borde fino por defecto y permite quitarlo', () => {
    expect(buildChessboardConfig({ position: START_FEN }).style.borderType).toBe(BORDER_TYPE.thin);
    expect(buildChessboardConfig({ position: START_FEN, border: 'thin' }).style.borderType).toBe(BORDER_TYPE.thin);
    expect(buildChessboardConfig({ position: START_FEN, border: 'none' }).style.borderType).toBe(BORDER_TYPE.none);
  });

  it('la ruta de assets es la que copia el build de las apps', () => {
    expect(CHESSBOARD_ASSETS_URL).toBe('assets/cm-chessboard/assets/');
  });
});

/**
 * Cada componente construía su tablero con un literal propio. Estos casos fijan que la
 * fábrica produce exactamente esa misma configuración para las opciones que hoy pasa
 * cada uno, de modo que migrar un componente no cambia lo que recibe cm-chessboard.
 */
describe('equivalencia con la configuración que construía cada componente', () => {
  class Markers {}
  class Arrows {}
  class PromotionDialog {}
  const common = {
    responsive: true,
    assetsUrl: 'assets/cm-chessboard/assets/',
    assetsCache: true,
  };
  const style = (borderType: string) => ({
    cssClass: 'chessboard-js',
    borderType,
    pieces: { file: 'pieces/standard.svg' },
  });

  it('board-puzzle y board-puzzle-solution: borde fino, sin orientation, con Markers, Arrows y PromotionDialog', () => {
    expect(
      buildChessboardConfig({
        position: START_FEN,
        extensions: [{ class: Markers }, { class: Arrows }, { class: PromotionDialog }],
      })
    ).toEqual({
      ...common,
      position: START_FEN,
      style: style('thin'),
      extensions: [{ class: Markers }, { class: Arrows }, { class: PromotionDialog }],
    });
  });

  it('fen-board: borde fino, sin orientation, solo Markers', () => {
    expect(buildChessboardConfig({ position: START_FEN, extensions: [{ class: Markers }] })).toEqual({
      ...common,
      position: START_FEN,
      style: style('thin'),
      extensions: [{ class: Markers }],
    });
  });

  it('board-game-player: borde fino, con orientation y Markers', () => {
    expect(
      buildChessboardConfig({ position: START_FEN, orientation: 'b', extensions: [{ class: Markers }] })
    ).toEqual({
      ...common,
      position: START_FEN,
      orientation: 'b',
      style: style('thin'),
      extensions: [{ class: Markers }],
    });
  });

  it('board-heatmap: sin borde, con orientation y sin extensiones', () => {
    const config = buildChessboardConfig({ position: START_FEN, orientation: 'w', border: 'none' });

    expect(config).toEqual({
      ...common,
      position: START_FEN,
      orientation: 'w',
      style: style('none'),
    });
    expect('extensions' in config).toBe(false);
  });
});

describe('createChessboard', () => {
  it('construye el tablero en el contenedor con la configuración común', () => {
    const container = {} as HTMLElement;

    const board = createChessboard(container, { position: START_FEN, orientation: 'w' }) as unknown as {
      element: HTMLElement;
      config: Record<string, unknown>;
    };

    expect(Chessboard).toHaveBeenCalledTimes(1);
    expect(board.element).toBe(container);
    expect(board.config).toEqual(buildChessboardConfig({ position: START_FEN, orientation: 'w' }));
  });
});
