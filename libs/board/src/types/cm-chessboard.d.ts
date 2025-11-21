declare module 'cm-chessboard' {
    export enum BOARD_TYPE {
        alpha = 'alpha',
        uscf = 'uscf'
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

    export interface MoveInputEvent {
        type: 'moveInputStarted' | 'validateMoveInput' | 'moveInputCanceled' | 'moveInputIllegal' | 'moveInputDone' | 'moveInputFinished';
        square?: string;
        squareFrom?: string;
        squareTo?: string;
        piece?: string;
        mouseEvent?: MouseEvent;
    }

    export interface PromotionResult {
        square: string;
        piece: string;
    }

    export interface MarkerType {
        class?: string;
        slice?: string;
        id?: string;
        position?: string;
    }

    export class Chessboard {
        constructor(element: HTMLElement, config?: ChessboardConfig);
        
        setPosition(fen: string, animated?: boolean): void;
        getPosition(): string;
        enableMoveInput(callback?: (event: MoveInputEvent) => boolean | any): void;
        disableMoveInput(): void;
        destroy(): void;
        
        // Extension methods
        removeArrows(): void;
        addMarker(marker: MarkerType, square: string): void;
        removeMarkers(marker?: MarkerType, square?: string): void;
        getMarkers(marker?: MarkerType, square?: string): any[];
        addArrow(arrow: any, from: string, to: string): void;
        showPromotionDialog(square: string, color: any, callback: (result: PromotionResult | null) => void): void;
        setPiece(square: string, piece: string | undefined, animated?: boolean): void;
    }

    export const COLOR: any;
    export const INPUT_EVENT_TYPE: 'moveInputStarted' | 'validateMoveInput' | 'moveInputCanceled' | 'moveInputIllegal' | 'moveInputDone';
    export const MOVE_INPUT_MODE: any;
    export const SQUARE_SELECT_TYPE: any;
    export const BORDER_TYPE: any;
}

declare module 'cm-chessboard/src/extensions/markers/Markers.js' {
    export const MARKER_TYPE: any;
    export class Markers {
        constructor();
    }
}

declare module 'cm-chessboard/src/extensions/arrows/Arrows.js' {
    export const ARROW_TYPE: any;
    export class Arrows {
        constructor();
    }
}

declare module 'cm-chessboard/src/extensions/promotion-dialog/PromotionDialog.js' {
    export class PromotionDialog {
        constructor();
    }
} 