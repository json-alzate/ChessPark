import { Injectable, Inject, InjectionToken } from '@angular/core';
import { Actions, ofType, createEffect } from '@ngrx/effects';
import { from } from 'rxjs';
import { switchMap, mergeMap, catchError } from 'rxjs/operators';

import { loadCustomPlans, addCustomPlans } from './custom-plans.actions';
import { Plan } from '@cpark/models';

export interface ICustomPlansFirestore {
  getCustomPlans(uidUser: string): Promise<Plan[]>;
  getCustomPlan(uid: string): Promise<Plan | null>;
  saveCustomPlan(plan: Plan): Promise<string | void>;
  updateCustomPlan(plan: Plan): Promise<void>;
}

export const CUSTOM_PLANS_FIRESTORE_TOKEN = new InjectionToken<ICustomPlansFirestore>(
  'CUSTOM_PLANS_FIRESTORE_TOKEN'
);

@Injectable()
export class CustomPlansEffects {
  loadCustomPlans$;

  constructor(
    private actions$: Actions,
    @Inject(CUSTOM_PLANS_FIRESTORE_TOKEN) private firestore: ICustomPlansFirestore
  ) {
    this.loadCustomPlans$ = createEffect(() =>
      this.actions$.pipe(
        ofType(loadCustomPlans),
        switchMap(({ uidUser }) =>
          from(this.firestore.getCustomPlans(uidUser)).pipe(
            mergeMap((plans) => [addCustomPlans({ plans })]),
            catchError((error) => {
              console.error('Error loading custom plans', error);
              return [addCustomPlans({ plans: [] })];
            })
          )
        )
      )
    );
  }
}
