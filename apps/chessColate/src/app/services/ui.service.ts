import { Injectable } from '@angular/core';
import { Store, select } from '@ngrx/store';

import { Observable, Subject } from 'rxjs';

import { UIState } from '@redux/states/ui.state';

// actions
import { setPiecesStyle, setBoardStyle } from '@redux/actions/ui.actions';

// selectors

// models
import { PiecesStyle, BoardStyle } from '@models/ui.model';

interface BoardStylesArray {
  name: BoardStyle;
  colorsSquares: {
    light: string;
    dark: string;
  };
}


@Injectable({
  providedIn: 'root'
})
export class UiService {

  changeStyle$ = new Subject<{ pieces: PiecesStyle; board: BoardStyle }>();

  private boardStyles: BoardStylesArray[] = [
    {
      name: 'default',
      colorsSquares: {
        light: '#ecdab9',
        dark: '#c5a076'
      }
    },
    {
      name: 'default-contrast',
      colorsSquares: {
        light: '#ecdab9',
        dark: '#c5a076'
      }
    },
    {
      name: 'blue',
      colorsSquares: {
        light: '#d8ecfb',
        dark: '#86afcf'
      }
    },
    {
      name: 'green',
      colorsSquares: {
        light: '#E0DDCC',
        dark: '#4c946a'
      }
    },
    {
      name: 'chess-club',
      colorsSquares: {
        light: '#E6D3B1',
        dark: '#AF6B3F'
      }
    },
    {
      name: 'chessboard-js',
      colorsSquares: {
        light: '#f0d9b5',
        dark: '#b58863'
      }
    },
    {
      name: 'black-and-white',
      colorsSquares: {
        light: '#ffffff',
        dark: '#9c9c9c'
      }
    }
  ];

  private boardStyleSelected: BoardStylesArray = this.boardStyles[0];

  private piecesStyles: PiecesStyle[] = ['cburnett', 'fantasy', 'staunty'];
  private piecesStyleSelected: PiecesStyle = 'fantasy';
  private baseUrl = '/assets/images/pieces/';

  constructor(
    private store: Store<UIState>,
  ) { }


  get currentPiecesStyleSelected() {
    return this.piecesStyleSelected;
  }

  get piecesPath() {
    return `${this.baseUrl}${this.piecesStyleSelected}/`;
  }

  get pieces() {
    return `${this.piecesPath}${this.piecesStyleSelected}.svg`;
  }

  get piecesStylesInfo() {
    const localPiecesStyles = [];
    for (const iteratorPiece of this.piecesStyles) {
      const objectToAdd = {
        name: iteratorPiece,
        piecesPath: `${this.baseUrl}${iteratorPiece}/`,
      };
      localPiecesStyles.push(objectToAdd);
    }
    return localPiecesStyles;
  }

  get boardStylesInfo() {
    return this.boardStyles;
  }

  get currentBoardStyleSelected() {
    return this.boardStyleSelected;
  }


  changePiecesStyle(name: PiecesStyle) {
    if (name === this.piecesStyleSelected) { return; }
    const theme = this.piecesStyles.find(t => t === name);
    if (theme) {
      this.piecesStyleSelected = theme;
    }
    this.emitChangeStyle();
    this.store.dispatch(setPiecesStyle({ piecesStyle: this.piecesStyleSelected }));
  }

  changeBoardStyle(name: BoardStyle) {
    if (name === this.boardStyleSelected.name) { return; }
    const theme = this.boardStyles.find(t => t.name === name);
    if (theme) {
      this.boardStyleSelected = theme;
    }
    this.emitChangeStyle();
    this.store.dispatch(setBoardStyle({ boardStyle: this.boardStyleSelected.name }));
  }

  subscribeToChangeStyle(): Observable<{ pieces: PiecesStyle; board: BoardStyle }> {
    return this.changeStyle$;
  }

  emitChangeStyle() {
    this.changeStyle$.next({ pieces: this.piecesStyleSelected, board: this.boardStyleSelected.name });
  }

}
