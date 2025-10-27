import { createSelector } from '@ngrx/store';

import { getAllUserPuzzles } from '@redux/selectors/user-puzzles.selectors';

import { getPuzzlesState, puzzlesAdapter } from '@redux/states/puzzles.state';

export const {
    selectAll: getAllPuzzles,
    selectTotal: getCountAllPuzzles,
    selectEntities: getPuzzlesEntities
} = puzzlesAdapter.getSelectors(getPuzzlesState);


/*
    Lógica del selector:
    se eligen los puzzles por resolver y los del usuario, y se elige uno al azar que no este en los del usuario.
    Si el resultado es 0, se manda a llamar a mas puzzles hasta que devuelva uno, de esta manera se asegura de siempre devolver uno
*/
export const getPuzzlesToResolve = () => createSelector(
    getAllPuzzles,
    getAllUserPuzzles,
    (puzzles, userPuzzles) => puzzles.filter(el => !userPuzzles.find(obj => el.uid === obj.uidPuzzle))
);
