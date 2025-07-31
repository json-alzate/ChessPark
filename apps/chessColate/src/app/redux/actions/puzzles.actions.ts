import { createAction, props } from '@ngrx/store';

import { Puzzle } from '@models/puzzle.model';


export const requestLoadPuzzles = createAction(
    '[Puzzles] requestLoadPuzzles',
    props<{ eloStar: number; eloEnd: number }>()
);

export const addPuzzles = createAction(
    '[Puzzles] addPuzzles',
    props<{ puzzles: Puzzle[] }>()
);
