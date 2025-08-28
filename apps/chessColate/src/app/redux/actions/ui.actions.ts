import { createAction, props } from '@ngrx/store';

import { PiecesStyle, BoardStyle } from '@models/ui.model';

export const activeLoading = createAction(
    '[UI] activeLoading'
);

export const stopLoading = createAction(
    '[UI] stopLoading'
);

export const addMessageToast = createAction(
    '[UI] addMessageToast',
    props<{ message: string; status: string }>()
);

export const clearMessageToast = createAction(
    '[UI] clearMessageToast'
);

export const setPiecesStyle = createAction(
    '[UI] setPiecesStyle',
    props<{ piecesStyle: PiecesStyle }>()
);

export const setBoardStyle = createAction(
    '[UI] setBoardStyle',
    props<{ boardStyle: BoardStyle }>()
);

