import { createReducer, on, Action } from '@ngrx/store';

import { PuzzlesState, puzzlesAdapter } from '@redux/states/puzzles.state';

import {
    addPuzzles
} from '@redux/actions/puzzles.actions';



export const initialState: PuzzlesState = puzzlesAdapter.getInitialState({});


export const ipuzzlesReducer = createReducer(
    initialState,

    on(addPuzzles, (state, { puzzles }) => puzzlesAdapter.addMany(puzzles, state))

);

export const puzzlesReducer = (state: PuzzlesState | undefined, action: Action) => ipuzzlesReducer(state, action);
