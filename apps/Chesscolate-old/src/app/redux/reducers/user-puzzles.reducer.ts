import { createReducer, on, Action } from '@ngrx/store';

import { UserPuzzlesState, userPuzzlesAdapter } from '@redux/states/user-puzzles.state';

import {
    addOneUserPuzzle,
    addUserPuzzles
} from '@redux/actions/user-puzzles.actions';



export const initialState: UserPuzzlesState = userPuzzlesAdapter.getInitialState({});


export const iuserPuzzlesReducer = createReducer(
    initialState,

    on(addUserPuzzles, (state, { userPuzzles }) => userPuzzlesAdapter.addMany(userPuzzles, state)),
    on(addOneUserPuzzle, (state, { userPuzzle }) => userPuzzlesAdapter.addOne(userPuzzle, state))

);

export const userPuzzlesReducer = (state: UserPuzzlesState | undefined, action: Action) => iuserPuzzlesReducer(state, action);
