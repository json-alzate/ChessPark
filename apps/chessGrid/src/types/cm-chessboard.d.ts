declare module 'cm-chessboard' {
  export enum BOARD_TYPE {
    alpha = 'alpha',
    uscf = 'uscf',
  }

  export interface ChessboardConfig {
    coordinates?: boolean;
    position?: string;
    style?: any;
    responsive?: boolean;
    animationDuration?: number;
    pieceStyle?: string;
    boardStyle?: string;
    [key: string]: any;
  }

  export class Chessboard {
    constructor(element: HTMLElement, config?: ChessboardConfig);

    setPosition(fen: string, animated?: boolean): void;
    getPosition(): string;
    enableMoveInput(callback?: (from: string, to: string) => boolean): void;
    disableMoveInput(): void;
    destroy(): void;
  }

  export const COLOR: any;
  export const INPUT_EVENT_TYPE:
    | 'moveInputStarted'
    | 'validateMoveInput'
    | 'moveInputCanceled'
    | 'moveInputIllegal'
    | 'moveInputDone';
  export const MOVE_INPUT_MODE: any;
  export const SQUARE_SELECT_TYPE: any;
  export const BORDER_TYPE: any;
}
