import { createReducer, on, Action } from '@ngrx/store';


import { CoordinatesPuzzlesState, coordinatesPuzzlesStateAdapter } from '@redux/states/coordinates-puzzles.state';

import { addCoordinatesPuzzles, addOneCoordinatesPuzzle } from '@redux/actions/coordinates-puzzles.actions';

export const initialState: CoordinatesPuzzlesState = coordinatesPuzzlesStateAdapter.getInitialState();

export const icoordinatesPuzzleReducer = createReducer(
    initialState,
    on(addCoordinatesPuzzles, (state, { coordinatesPuzzles }) => {
        return coordinatesPuzzlesStateAdapter.addMany(coordinatesPuzzles, state);
    }),

    on(addOneCoordinatesPuzzle, (state, { coordinatesPuzzle }) => {
        return coordinatesPuzzlesStateAdapter.addOne(coordinatesPuzzle, state);
    })
);

export function coordinatesPuzzleReducer(state: CoordinatesPuzzlesState | undefined, action: Action) {
    return icoordinatesPuzzleReducer(state, action);
}