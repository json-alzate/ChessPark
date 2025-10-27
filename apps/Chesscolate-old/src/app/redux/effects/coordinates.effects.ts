import { Injectable } from '@angular/core';
import { Actions, ofType, createEffect } from '@ngrx/effects';

import { mergeMap, switchMap, exhaustMap } from 'rxjs/operators';

import {
    addCoordinatesPuzzles,
    requestGetCoordinatesPuzzles,
    requestAddOneCoordinatesPuzzleT,
    addOneCoordinatesPuzzle
} from '@redux/actions/coordinates-puzzles.actions';

import { CoordinatesPuzzlesService } from '@services/coordinates-puzzles.service';

@Injectable()
export class CoordinatesEffects {

    requestGetCoordinatesPuzzles$ = createEffect(() =>
        this.actions$.pipe(
            ofType(requestGetCoordinatesPuzzles),
            switchMap(({ uidUser }) =>
                this.coordinatesPuzzlesService.getCoordinatesPuzzles(uidUser).pipe(
                    mergeMap((coordinatesPuzzles) => [
                        addCoordinatesPuzzles({ coordinatesPuzzles })

                    ])
                ))
        )
    );

    requestAddOneCoordinatesPuzzle$ = createEffect(() =>
        this.actions$.pipe(
            ofType(requestAddOneCoordinatesPuzzleT),
            exhaustMap((data) => // TODO: Se utiliza por que la acción parece ejecutarse dos veces a pesar de que se llama 1, no se por que
                this.coordinatesPuzzlesService.addCoordinatesPuzzle(data.coordinatesPuzzle).pipe(
                    mergeMap((docId) => [
                        addOneCoordinatesPuzzle({ coordinatesPuzzle: { ...data.coordinatesPuzzle, uid: docId } })
                    ])
                )
            )
        )
    );





    constructor(
        private actions$: Actions,
        private coordinatesPuzzlesService: CoordinatesPuzzlesService
    ) { }

}
