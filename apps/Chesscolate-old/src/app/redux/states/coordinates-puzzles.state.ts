import { createFeatureSelector } from '@ngrx/store';
import { EntityState, EntityAdapter, createEntityAdapter } from '@ngrx/entity';

/** Models **/
import { CoordinatesPuzzle } from '@models/coordinates-puzzles.model';

export type CoordinatesPuzzlesState = EntityState<CoordinatesPuzzle>;

export const coordinatesPuzzlesStateAdapter: EntityAdapter<CoordinatesPuzzle> = createEntityAdapter<CoordinatesPuzzle>({
    selectId: (coordinatesPuzzle) => coordinatesPuzzle.uid
});

export const getCoordinatesPuzzlesState = createFeatureSelector<CoordinatesPuzzlesState>('coordinatesPuzzles');
