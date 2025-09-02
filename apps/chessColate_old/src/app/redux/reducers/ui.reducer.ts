import { createReducer, on, Action } from '@ngrx/store';

import {
  activeLoading,
  stopLoading,
  addMessageToast,
  clearMessageToast,
  setPiecesStyle,
  setBoardStyle
} from '@redux/actions/ui.actions';

import { UIState } from '@redux/states/ui.state';

export const initialState: UIState = {
  loading: false,
  toast: null,
  typeToast: null,
  piecesStyle: 'fantasy',
  boardStyle: 'default'
};

export const iuiReducer = createReducer(
  initialState,

  on(activeLoading, (state) => ({
    ...state,
    loading: true
  })),

  on(stopLoading, (state) => ({
    ...state,
    loading: false
  })),

  on(addMessageToast, (state, { message, status }) => ({
    ...state,
    toast: message,
    typeToast: status
  })),

  on(clearMessageToast, (state) => ({
    ...state,
    toast: null,
    typeToast: null
  })),

  on(setPiecesStyle, (state, { piecesStyle }) => ({
    ...state,
    piecesStyle
  })),
  on(setBoardStyle, (state, { boardStyle }) => ({
    ...state,
    boardStyle
  }))
);

export const uiReducer = (state: UIState | undefined, action: Action) => iuiReducer(state, action);


