import { createAction, props } from '@ngrx/store';

import { UserPuzzle } from '@models/user-puzzles.model';


export const requestLoadUserPuzzles = createAction(
    '[UserPuzzles] requestLoadUserPuzzles',
    props<{ uidUser: string }>()
);

export const addUserPuzzles = createAction(
    '[UserPuzzles] addPuzzles',
    props<{ userPuzzles: UserPuzzle[] }>()
);

export const requestAddOneUserPuzzle = createAction(
    '[UserPuzzles] requestAddOneUserPuzzle',
    props<{ userPuzzle: UserPuzzle }>()
);

export const addOneUserPuzzle = createAction(
    '[UserPuzzles] addOneUserPuzzle',
    props<{ userPuzzle: UserPuzzle }>()
);
