/**
 * Sustitutos de los componentes de tablero de `@chesspark/board` (cm-chessboard no se
 * puede cargar en Jest: su paquete resuelve a un index.html).
 *
 * Se usan así, desde el spec que lo necesite:
 *
 *   jest.mock('@chesspark/board', () =>
 *     jest.requireActual('<ruta relativa>/tests/support/analisis-juegos.tablero'));
 *
 * Todos los métodos son `jest.fn` para poder comprobar qué le pidió la pantalla al tablero.
 */
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({ selector: 'lib-board', standalone: true, template: '' })
export class BoardComponent {
  @Output() squareSelected = new EventEmitter<string>();

  /** Las pantallas esperan a que el tablero interno exista antes de configurarlo. */
  board: unknown = {};
  ready = true;
  orientation: 'w' | 'b' = 'w';

  isBoardReady = jest.fn(() => this.ready);
  setPosition = jest.fn();
  toggleCoordinates = jest.fn();
  togglePieces = jest.fn();
  changeOrientation = jest.fn((o: 'w' | 'b') => {
    this.orientation = o;
  });
  getOrientation = jest.fn(() => this.orientation);
  addMarker = jest.fn();
  removeMarkers = jest.fn();
  getMarkers = jest.fn((): unknown[] => []);
}

@Component({ selector: 'lib-board-game-player', standalone: true, template: '' })
export class BoardGamePlayerComponent {
  @Input() fens: string[] = [];
  @Input() moveSquares: unknown[] = [];
  @Input() msPerMove = 2000;
  @Input() soundEnabled = true;
  @Input() orientation: 'w' | 'b' = 'w';
  @Output() indexChange = new EventEmitter<number>();
  @Output() playingChange = new EventEmitter<boolean>();
  @Output() finished = new EventEmitter<void>();

  play = jest.fn();
  togglePlay = jest.fn();
  previous = jest.fn();
  next = jest.fn();
  toStart = jest.fn();
  toEnd = jest.fn();
  goTo = jest.fn();
  flip = jest.fn();
}

@Component({ selector: 'lib-board-heatmap', standalone: true, template: '' })
export class BoardHeatmapComponent {
  @Input() counts: Record<string, number> = {};
  @Input() startSquare = '';
  @Input() piece = '';
  @Input() pieceSquare = '';
  @Input() orientation: 'w' | 'b' = 'w';
}

@Component({ selector: 'lib-board-player-info', standalone: true, template: '' })
export class BoardPlayerInfoComponent {
  @Input() name = '';
  @Input() rating: number | null = null;
  @Input() clock = '';
}
