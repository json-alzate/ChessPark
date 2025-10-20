import { Injectable } from '@angular/core';
import { Actions, ofType, createEffect } from '@ngrx/effects';

import { from } from 'rxjs';
import { mergeMap, switchMap, catchError } from 'rxjs/operators';

import {
    requestAddOneCustomPlan, requestGetCustomPlans, requestUpdateCustomPlan,
    addCustomPlans, updateCustomPlan, addOneCustomPlan
} from '@redux/actions/custom-plans.actions';

import { CustomPlansService } from '@services/custom-plans.service';

@Injectable()
export class CustomPlansEffects {


    requestGetCustomPlans$ = createEffect(() =>
        this.actions$.pipe(
            ofType(requestGetCustomPlans),
            switchMap(({ uidUser }) =>
                from(this.customPlansService.requestGetCustomPlans(uidUser)).pipe(
                    mergeMap((customPlans) => [addCustomPlans({ customPlans })]),
                    catchError((error) => {
                        console.error('Error getting customPlans', error);
                        return [];
                    })
                ))
        )
    );


    requestAddOneCustomPlan$ = createEffect(() =>
        this.actions$.pipe(
            ofType(requestAddOneCustomPlan),
            switchMap(({ customPlan }) =>
                from(this.customPlansService.saveCustomPlan(customPlan)).pipe(
                    mergeMap(() => [
                        addOneCustomPlan({ customPlan })
                    ]),
                    catchError((error) => {
                        console.error('Error saving addOneCustomPlan', error);
                        return [];
                    })
                ))
        )
    );


    requestUpdateCustomPlan$ = createEffect(() =>
        this.actions$.pipe(
            ofType(requestUpdateCustomPlan),
            switchMap(({ customPlan }) =>
                from(this.customPlansService.updateCustomPlan(customPlan)).pipe(
                    mergeMap(() => [
                        updateCustomPlan({ customPlan: { id: customPlan.uid, changes: customPlan } })
                    ]),
                    catchError((error) => {
                        console.error('Error updating customPlan', error);
                        return [];
                    })
                ))
        )
    );


    constructor(
        private actions$: Actions,
        private customPlansService: CustomPlansService
    ) { }

}
