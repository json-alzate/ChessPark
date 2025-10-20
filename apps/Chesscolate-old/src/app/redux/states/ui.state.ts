import { createFeatureSelector } from '@ngrx/store';

import { PiecesStyle, BoardStyle } from '@models/ui.model';


export interface UIState {
    loading: boolean;
    toast: string | null;
    typeToast: string;
    piecesStyle: PiecesStyle;
    boardStyle: BoardStyle;
    // TODO: sonidos
}

export const getUIState = createFeatureSelector<UIState>('ui');
