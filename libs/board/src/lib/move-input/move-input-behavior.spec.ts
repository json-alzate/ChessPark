/**
 * Caracterización del manejador de movimientos de los dos tableros de puzzle
 * (`BoardPuzzleComponent` y `BoardPuzzleSolutionComponent`).
 *
 * Ninguno de los dos tenía tests de comportamiento, y los dos repetían el mismo flujo:
 * marcar casillas posibles, aceptar o rechazar la jugada, y el diálogo de promoción.
 * Este spec ejecuta los mismos escenarios contra cada componente y registra la secuencia
 * exacta de llamadas al tablero, para poder cambiar cómo está escrito ese flujo sin cambiar
 * lo que hace.
 *
 * cm-chessboard, Ionic y los servicios compartidos se sustituyen por dobles: Jest no carga
 * los módulos ESM de cm-chessboard, y aquí interesa la lógica, no el dibujo real.
 */
import { Renderer2 } from '@angular/core';
import { TestBed } from '@angular/core/testing';

jest.mock('cm-chessboard', () => ({
  COLOR: { white: 'w', black: 'b' },
  INPUT_EVENT_TYPE: {},
  MOVE_INPUT_MODE: {},
  SQUARE_SELECT_TYPE: {},
  BORDER_TYPE: { none: 'none', thin: 'thin', frame: 'frame' },
  Chessboard: class {},
}));
jest.mock('cm-chessboard/src/extensions/markers/Markers.js', () => ({ Markers: class {}, MARKER_TYPE: {} }));
jest.mock('cm-chessboard/src/extensions/arrows/Arrows.js', () => ({ Arrows: class {}, ARROW_TYPE: {} }));
jest.mock('cm-chessboard/src/extensions/promotion-dialog/PromotionDialog.js', () => ({ PromotionDialog: class {} }));
jest.mock('@ionic/angular/standalone', () => ({ IonIcon: class {}, ModalController: class {} }));
jest.mock('ionicons', () => ({ addIcons: jest.fn() }));
jest.mock('ionicons/icons', () => new Proxy({ __esModule: true } as Record<string, unknown>, {
  get: (target, key) => (key in target ? target[key as string] : String(key)),
}));
jest.mock('@jsverse/transloco', () => ({ TranslocoPipe: class {} }));
jest.mock('@chesspark/common-utils', () => ({
  SoundsService: class {},
  UidGeneratorService: class {},
  SecondsToMinutesSecondsPipe: class {},
}));
jest.mock('../stockfish-engine/stockfish-engine.facade', () => ({ StockfishEngineFacade: class {} }));
jest.mock('../chessboard-factory/create-chessboard', () => ({ createChessboard: jest.fn() }));

import { ModalController } from '@ionic/angular/standalone';
import { SoundsService, UidGeneratorService } from '@chesspark/common-utils';
import { createChessboard } from '../chessboard-factory/create-chessboard';
import { StockfishEngineFacade } from '../stockfish-engine/stockfish-engine.facade';
import { BoardPuzzleComponent } from '../board-puzzle/board-puzzle.component';
import { BoardPuzzleSolutionComponent } from '../board-puzzle-solution/board-puzzle-solution.component';

/** Blancas: rey en a1, peón en a7 (puede coronar en a8); negras: rey en h7. Mueven blancas. */
const START_FEN = '8/P6k/8/8/8/8/8/K7 w - - 0 1';
/** Jugada de la solución: el peón corona. Solo hace falta que sea legal para cargar el puzzle. */
const SOLUTION_MOVES = 'a7a8q';

type MoveInputEvent = {
  type: string;
  square?: string;
  squareFrom?: string;
  squareTo?: string;
  piece?: string;
};

/** Tablero falso: cada llamada que cambia algo queda registrada en `calls`, en orden. */
function createFakeBoard() {
  const calls: string[] = [];
  const log = (entry: string) => calls.push(entry);
  const markerName = (type: { class?: string }) => type?.class ?? '?';
  const board = {
    removeMarkers: jest.fn(() => log('removeMarkers')),
    addMarker: jest.fn((type: { class?: string }, square: string) => log(`addMarker:${markerName(type)}@${square}`)),
    getMarkers: jest.fn(() => []),
    removeArrows: jest.fn(() => log('removeArrows')),
    addArrow: jest.fn((type: { id?: string }, from: string, to: string) => log(`addArrow:${type?.id}@${from}-${to}`)),
    setPosition: jest.fn((fen: string, animated?: boolean) => {
      log(`setPosition:${fen}:${animated}`);
      return Promise.resolve();
    }),
    setOrientation: jest.fn(),
    getOrientation: jest.fn(() => 'w'),
    // El tercer argumento (la función que se llama al elegir pieza) lo leen los tests desde mock.calls
    showPromotionDialog: jest.fn<void, [string, string, unknown]>((square, color) => log(`showPromotionDialog:${square}:${color}`)),
    enableMoveInput: jest.fn(),
    disableMoveInput: jest.fn(),
    destroy: jest.fn(),
  };
  return { board, calls };
}

/**
 * Las casillas de destino se dibujan en el orden en que las devuelve chess.js. Ese orden no
 * es parte del comportamiento que interesa fijar, así que cada tanda de puntos se ordena.
 */
function normalize(calls: string[]): string[] {
  const isDot = (entry: string) => entry.startsWith('addMarker:marker-dot-green@');
  const out: string[] = [];
  let run: string[] = [];
  const flush = () => {
    out.push(...run.sort());
    run = [];
  };
  for (const entry of calls) {
    if (isDot(entry)) {
      run.push(entry);
    } else {
      flush();
      out.push(entry);
    }
  }
  flush();
  return out;
}

interface Harness {
  /** Manejador que el componente registró en el tablero. */
  handle: (event: MoveInputEvent) => unknown;
  board: ReturnType<typeof createFakeBoard>['board'];
  calls: string[];
  /** Posición actual según el estado de ajedrez del componente. */
  fen: () => string;
  /** Espía de lo que el componente hace cuando acepta una jugada. */
  validateMove: jest.Mock;
  component: unknown;
}

type Setup = () => Promise<Harness>;

function baseProviders(): void {
  TestBed.configureTestingModule({
    providers: [
      { provide: Renderer2, useValue: { setStyle: jest.fn() } },
      { provide: UidGeneratorService, useValue: {} },
      { provide: SoundsService, useValue: { determineChessMoveType: jest.fn(), playError: jest.fn(), playGood: jest.fn() } },
      { provide: ModalController, useValue: { dismiss: jest.fn() } },
      { provide: StockfishEngineFacade, useValue: { isReady: false, initialize: jest.fn(), cancel: jest.fn(), dispose: jest.fn(), getBestMove: jest.fn() } },
    ],
  });
}

const setupPuzzle: Setup = async () => {
  baseProviders();
  const { board, calls } = createFakeBoard();
  (createChessboard as jest.Mock).mockReturnValue(board);
  const component = TestBed.runInInjectionContext(
    () => new BoardPuzzleComponent(TestBed.inject(Renderer2), TestBed.inject(UidGeneratorService))
  );
  component.boardContainer = { nativeElement: {} };
  await component.buildBoard(START_FEN);
  // El motor del componente queda en la posición de prueba
  (component as unknown as { engine: { load(p: { fen: string; moves: string }): void } }).engine.load({
    fen: START_FEN,
    moves: SOLUTION_MOVES,
  });
  const validateMove = jest.fn();
  (component as unknown as { validateMove: jest.Mock }).validateMove = validateMove;
  calls.length = 0;
  return {
    handle: board.enableMoveInput.mock.calls[0][0],
    board,
    calls,
    fen: () => (component as unknown as { engine: { fen: string } }).engine.fen,
    validateMove,
    component,
  };
};

const setupSolution: Setup = async () => {
  baseProviders();
  const { board, calls } = createFakeBoard();
  (createChessboard as jest.Mock).mockReturnValue(board);
  const component = TestBed.runInInjectionContext(() => new BoardPuzzleSolutionComponent());
  component.puzzle = { fen: START_FEN, moves: SOLUTION_MOVES } as never;
  // buildBoard reproduce la primera respuesta de la máquina con esperas: aquí no interesa
  jest.spyOn(component, 'puzzleMoveResponse').mockResolvedValue(undefined);
  await component.buildBoard(START_FEN);
  // buildBoard deja el estado de ajedrez al final de la solución; se vuelve a la posición de prueba
  component.chessInstance.load(START_FEN);
  component.currentMoveNumber = 0;
  const validateMove = jest.fn();
  (component as unknown as { validateMove: jest.Mock }).validateMove = validateMove;
  calls.length = 0;
  return {
    handle: board.enableMoveInput.mock.calls[0][0],
    board,
    calls,
    fen: () => component.chessInstance.fen(),
    validateMove,
    component,
  };
};

describe.each([
  ['BoardPuzzleComponent', setupPuzzle],
  ['BoardPuzzleSolutionComponent', setupSolution],
] as [string, Setup][])('manejador de movimientos de %s', (_name, setup) => {
  let h: Harness;

  beforeEach(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    h = await setup();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  describe('al empezar a mover una pieza', () => {
    it('limpia el tablero y marca la casilla elegida y las casillas a las que puede ir', () => {
      const result = h.handle({ type: 'moveInputStarted', square: 'a1' });

      expect(result).toBe(true);
      expect(normalize(h.calls)).toEqual([
        'removeMarkers',
        'removeMarkers', // showLastMove vuelve a limpiar y, sin jugada previa, no dibuja nada
        'removeArrows',
        'addMarker:marker-square-green@a1',
        'addMarker:marker-dot-green@a2',
        'addMarker:marker-dot-green@b1',
        'addMarker:marker-dot-green@b2',
      ]);
    });

    it('no marca casillas si la pieza no puede moverse (es del rival)', () => {
      const result = h.handle({ type: 'moveInputStarted', square: 'h7' });

      expect(result).toBe(true);
      expect(h.calls).toEqual(['removeMarkers', 'removeMarkers', 'removeArrows']);
    });
  });

  describe('al soltar la pieza (jugada normal)', () => {
    it('una jugada legal se acepta, se dibuja como última jugada y se valida', () => {
      const result = h.handle({ type: 'validateMoveInput', squareFrom: 'a1', squareTo: 'b2', piece: 'wk' });

      expect(result).toBe(true);
      expect(h.calls).toEqual([
        'removeArrows',
        'removeMarkers',
        'addMarker:marker-square-green@a1',
        'addMarker:marker-square-green@b2',
      ]);
      expect(h.validateMove).toHaveBeenCalledTimes(1);
      expect(h.fen()).toBe('8/P6k/8/8/8/8/1K6/8 b - - 1 1');
    });

    it('una jugada ilegal se rechaza, no cambia la posición y no se valida', () => {
      const before = h.fen();

      const result = h.handle({ type: 'validateMoveInput', squareFrom: 'a1', squareTo: 'h8', piece: 'wk' });

      expect(result).toBe(false);
      expect(h.calls).toEqual(['removeMarkers', 'removeMarkers']);
      expect(h.validateMove).not.toHaveBeenCalled();
      expect(h.fen()).toBe(before);
    });

    it('sin casillas de origen y destino se rechaza', () => {
      const result = h.handle({ type: 'validateMoveInput' });

      expect(result).toBe(false);
      expect(h.calls).toEqual(['removeMarkers', 'removeMarkers']);
      expect(h.validateMove).not.toHaveBeenCalled();
    });
  });

  describe('al coronar un peón', () => {
    const promote = { type: 'validateMoveInput', squareFrom: 'a7', squareTo: 'a8', piece: 'wp' };

    it('si el peón no puede llegar a esa casilla se rechaza sin abrir el diálogo', () => {
      const result = h.handle({ type: 'validateMoveInput', squareFrom: 'a7', squareTo: 'b8', piece: 'wp' });

      expect(result).toBe(false);
      expect(h.board.showPromotionDialog).not.toHaveBeenCalled();
      expect(h.calls).toEqual(['removeMarkers', 'removeMarkers']);
    });

    it('si puede llegar abre el diálogo con el color de la pieza y espera la elección', () => {
      const result = h.handle(promote);

      expect(result).toBe(true);
      expect(h.calls).toEqual(['showPromotionDialog:a8:w']);
      expect(h.validateMove).not.toHaveBeenCalled();
    });

    it('al elegir una pieza aplica la jugada, sincroniza el tablero y la valida', () => {
      h.handle(promote);
      const choose = h.board.showPromotionDialog.mock.calls[0][2] as (r?: { piece: string }) => void;

      choose({ piece: 'wq' });

      const promotedFen = h.fen();
      expect(promotedFen).toBe('Q7/7k/8/8/8/8/8/K7 b - - 0 1');
      expect(h.calls).toEqual([
        'showPromotionDialog:a8:w',
        `setPosition:${promotedFen}:false`,
        'removeArrows',
        'removeMarkers',
        'addMarker:marker-square-green@a7',
        'addMarker:marker-square-green@a8',
      ]);
      expect(h.validateMove).toHaveBeenCalledTimes(1);
    });

    it('si se cierra el diálogo sin elegir, devuelve el tablero a la posición y no valida', () => {
      h.handle(promote);
      const choose = h.board.showPromotionDialog.mock.calls[0][2] as (r?: { piece: string }) => void;

      choose(undefined);

      expect(h.fen()).toBe(START_FEN);
      expect(h.calls).toEqual([
        'showPromotionDialog:a8:w',
        `setPosition:${START_FEN}:false`,
        'removeMarkers',
        'removeMarkers',
      ]);
      expect(h.validateMove).not.toHaveBeenCalled();
    });

    it('si la pieza elegida no es válida, devuelve el tablero a la posición y no valida', () => {
      h.handle(promote);
      const choose = h.board.showPromotionDialog.mock.calls[0][2] as (r?: { piece: string }) => void;

      choose({ piece: 'wk' });

      expect(h.fen()).toBe(START_FEN);
      expect(h.calls).toEqual([
        'showPromotionDialog:a8:w',
        `setPosition:${START_FEN}:false`,
        'removeMarkers',
        'removeMarkers',
      ]);
      expect(h.validateMove).not.toHaveBeenCalled();
    });
  });

  describe('otros eventos', () => {
    it('al cancelar la jugada limpia marcadores y flechas', () => {
      const result = h.handle({ type: 'moveInputCanceled' });

      expect(result).toBe(true);
      expect(h.calls).toEqual(['removeMarkers', 'removeMarkers', 'removeArrows']);
    });

    it('al terminar la jugada y ante eventos desconocidos acepta sin tocar el tablero', () => {
      expect(h.handle({ type: 'moveInputFinished' })).toBe(true);
      expect(h.handle({ type: 'otroEvento' })).toBe(true);
      expect(h.calls).toEqual([]);
    });
  });
});

describe('BoardPuzzleSolutionComponent: flechas de Stockfish', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('al cancelar con Stockfish activo se vuelven a dibujar sus flechas', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const h = await setupSolution();
    const component = h.component as BoardPuzzleSolutionComponent;
    component.stockfishEnabled = true;
    component.bestMove = 'a1b2';

    h.handle({ type: 'moveInputCanceled' });

    // removeArrows() de la solución borra todo y redibuja la flecha de Stockfish
    expect(h.calls.filter((c) => c === 'addArrow:stockfishBestMove@a1-b2')).toHaveLength(1);
    expect(h.calls[h.calls.length - 1]).toBe('addArrow:stockfishBestMove@a1-b2');
  });

  it('al aceptar una jugada borra las flechas sin redibujar la de Stockfish', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const h = await setupSolution();
    const component = h.component as BoardPuzzleSolutionComponent;
    component.stockfishEnabled = true;
    component.bestMove = 'a1b2';

    h.handle({ type: 'validateMoveInput', squareFrom: 'a1', squareTo: 'b2', piece: 'wk' });

    expect(h.calls.filter((c) => c.startsWith('addArrow'))).toEqual([]);
  });
});
