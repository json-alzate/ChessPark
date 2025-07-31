import { createFeatureSelector } from '@ngrx/store';

import { EntityState, EntityAdapter, createEntityAdapter } from '@ngrx/entity';

import { Puzzle } from '@models/puzzle.model';


export type PuzzlesState = EntityState<Puzzle>;

export const puzzlesAdapter: EntityAdapter<Puzzle> = createEntityAdapter<Puzzle>({
    selectId: (puzzle) => puzzle.uid
});


export const getPuzzlesState = createFeatureSelector<PuzzlesState>('puzzles');

