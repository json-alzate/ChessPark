import { Injectable } from '@angular/core';
import { Actions, ofType, createEffect } from '@ngrx/effects';

import { from } from 'rxjs';
import { mergeMap, switchMap, catchError } from 'rxjs/operators';

import {
    requestSavePlan, requestGetPlans, addPlans, addPlan
} from '@redux/actions/plans.actions';

import { PlanService } from '@services/plan.service';

@Injectable()
export class PlanEffects {


    requestGetPlans$ = createEffect(() =>
        this.actions$.pipe(
            ofType(requestGetPlans),
            switchMap(({ uidUser }) =>
                from(this.planService.getPlans(uidUser)).pipe(
                    mergeMap((plans) => [addPlans({ plans })]),
                    catchError((error) => {
                        console.error('Error getting plans', error);
                        return [];
                    })
                ))
        )
    );


    requestSavePlan$ = createEffect(() =>
        this.actions$.pipe(
            ofType(requestSavePlan),
            switchMap(({ plan }) =>
                from(this.planService.savePlan(plan)).pipe(
                    mergeMap(() => [
                        addPlan({ plan })
                    ]),
                    catchError((error) => {
                        console.error('Error saving plan', error);
                        return [];
                    })
                ))
        )
    );


    constructor(
        private actions$: Actions,
        private planService: PlanService
    ) { }

}
