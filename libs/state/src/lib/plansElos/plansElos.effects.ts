import { Injectable, Inject, InjectionToken } from '@angular/core';
import { Actions, ofType, createEffect } from '@ngrx/effects';
import { from } from 'rxjs';
import { switchMap, mergeMap, catchError } from 'rxjs/operators';

import {
  requestAddOnePlanElo,
  addOnePlanElo,
  requestLoadPlansElos,
  addPlansElos,
  updatePlanElos,
  requestUpdatePlanElos,
} from './plansElos.actions';
import { PlanElos } from '@cpark/models';

/**
 * Interface para el servicio de Firestore que debe ser proporcionado por la app
 * La app debe implementar esta interface y proveer el servicio mediante injection token
 */
export interface IFirestoreService {
  getPlansElos(uidUser: string): Promise<PlanElos[]>;
  getPlanElos(uidPlan: string, uidUser: string): Promise<PlanElos>;
  savePlanElo(planElo: PlanElos): Promise<string | void>;
  updatePlanElo(planElo: PlanElos): Promise<void>;
}

// Injection token para el servicio de Firestore
export const FIRESTORE_SERVICE_TOKEN = new InjectionToken<IFirestoreService>('FIRESTORE_SERVICE_TOKEN');

@Injectable()
export class PlansElosEffects {
  requestLoadPlansElos$;
  requestAddOnePlanElo$;
  requestUpdatePlanElos$;

  constructor(
    private actions$: Actions,
    @Inject(FIRESTORE_SERVICE_TOKEN) private firestoreService: IFirestoreService
  ) {
    this.requestLoadPlansElos$ = createEffect(() =>
      this.actions$.pipe(
        ofType(requestLoadPlansElos),
        switchMap(({ uidUser }) =>
          from(this.firestoreService.getPlansElos(uidUser)).pipe(
            mergeMap((plansElos) => [addPlansElos({ plansElos })]),
            catchError((error) => {
              console.error('Error getting plansElos', error);
              return [];
            })
          )
        )
      )
    );

    this.requestAddOnePlanElo$ = createEffect(() =>
      this.actions$.pipe(
        ofType(requestAddOnePlanElo),
        switchMap(({ planElo }) =>
          from(this.firestoreService.savePlanElo(planElo)).pipe(
            mergeMap(() => [addOnePlanElo({ planElo })]),
            catchError((error) => {
              console.error('Error saving planElos', error);
              return [];
            })
          )
        )
      )
    );

    this.requestUpdatePlanElos$ = createEffect(() =>
      this.actions$.pipe(
        ofType(requestUpdatePlanElos),
        switchMap(({ planElo }) =>
          from(this.firestoreService.updatePlanElo(planElo)).pipe(
            mergeMap(() => [
              updatePlanElos({ planElo: { id: planElo.uid, changes: planElo } })
            ]),
            catchError((error) => {
              console.error('Error updating planElos', error);
              return [];
            })
          )
        )
      )
    );
  }
}
