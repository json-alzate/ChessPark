import { createSelector } from '@ngrx/store';

import { getUserPuzzlesState, userPuzzlesAdapter } from '@redux/states/user-puzzles.state';

export const {
    selectAll: getAllUserPuzzles,
    selectTotal: getCountAllUserPuzzles,
    selectEntities: getUserPuzzlesEntities
} = userPuzzlesAdapter.getSelectors(getUserPuzzlesState);
