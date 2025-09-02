import { Injectable } from '@angular/core';
import { Actions, ofType, createEffect } from '@ngrx/effects';

import { from } from 'rxjs';
import { mergeMap, switchMap, catchError } from 'rxjs/operators';

import {
    requestAddOnePlanElo, addOnePlanElo, requestLoadPlansElos, addPlansElos, updatePlanElos, requestUpdatePlanElos
} from '@redux/actions/plans-elos.actions';

import { PlansElosService } from '@services/plans-elos.service';

@Injectable()
export class PlaneElosEffects {


    requestLoadPlansElos$ = createEffect(() =>
        this.actions$.pipe(
            ofType(requestLoadPlansElos),
            switchMap(({ uidUser }) =>
                from(this.planElosService.requestGetPlansElos(uidUser)).pipe(
                    mergeMap((plansElos) => [addPlansElos({ plansElos })]),
                    catchError((error) => {
                        console.error('Error getting plansElos', error);
                        return [];
                    })
                ))
        )
    );


    requestAddOnePlanElo$ = createEffect(() =>
        this.actions$.pipe(
            ofType(requestAddOnePlanElo),
            switchMap(({ planElo }) =>
                from(this.planElosService.savePlanElo(planElo)).pipe(
                    mergeMap(() => [
                        addOnePlanElo({ planElo })
                    ]),
                    catchError((error) => {
                        console.error('Error saving planElos', error);
                        return [];
                    })
                ))
        )
    );


    requestUpdatePlanElos$ = createEffect(() =>
        this.actions$.pipe(
            ofType(requestUpdatePlanElos),
            switchMap(({ planElo }) =>
                from(this.planElosService.updatePlanElo(planElo)).pipe(
                    mergeMap(() => [
                        updatePlanElos({ planElo: { id: planElo.uid, changes: planElo } })
                    ]),
                    catchError((error) => {
                        console.error('Error updating planElos', error);
                        return [];
                    })
                ))
        )
    );


    constructor(
        private actions$: Actions,
        private planElosService: PlansElosService
    ) { }

}
