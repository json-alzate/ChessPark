import { createSelector } from '@ngrx/store';

import { getUIState } from '@redux/states/ui.state';
import { UIState } from '@redux/states/ui.state';


export const getLoading = createSelector(
  getUIState,
  uiState => uiState.loading
);

export const getPiecesStyle = createSelector(
  getUIState,
  uiState => uiState.piecesStyle
);

export const getBoardStyle = createSelector(
  getUIState,
  uiState => uiState.boardStyle
);


export const getToast = createSelector(
  getUIState,
  (state: UIState) => ({
    message: state.toast,
    status: state.typeToast
  })
);
