import { createFeatureSelector } from '@ngrx/store';

import { EntityState, EntityAdapter, createEntityAdapter } from '@ngrx/entity';

import { UserPuzzle } from '@models/user-puzzles.model';


export type UserPuzzlesState = EntityState<UserPuzzle>;

export const userPuzzlesAdapter: EntityAdapter<UserPuzzle> = createEntityAdapter<UserPuzzle>({
    selectId: (userPuzzle) => userPuzzle.uid
});


export const getUserPuzzlesState = createFeatureSelector<UserPuzzlesState>('userPuzzles');

