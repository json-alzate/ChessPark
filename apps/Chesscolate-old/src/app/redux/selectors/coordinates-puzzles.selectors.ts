import { createSelector } from '@ngrx/store';

import { getCoordinatesPuzzlesState, coordinatesPuzzlesStateAdapter } from '@redux/states/coordinates-puzzles.state';

import { CoordinatesPuzzle } from '@models/coordinates-puzzles.model';

export const {
    selectAll: getAllCoordinatesPuzzles,
    selectTotal: getCountAllCoordinatesPuzzles,
    selectEntities: getCoordinatesPuzzlesEntities
} = coordinatesPuzzlesStateAdapter.getSelectors(getCoordinatesPuzzlesState);


export const getLastCoordinatesPuzzles = (count: number) => createSelector(
    getAllCoordinatesPuzzles,
    (coordinatesPuzzles: CoordinatesPuzzle[]) => {

        const coordinatesPuzzlesShort = coordinatesPuzzles.sort((obj1, obj2) => {
            if (obj1.date > obj2.date) {
                return 1;
            }
            if (obj1.date < obj2.date) {
                return -1;
            }
            return 0;
        });

        return coordinatesPuzzlesShort.slice(-count);

    }
);
