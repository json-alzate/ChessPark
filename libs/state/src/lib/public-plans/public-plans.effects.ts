import { Injectable, Inject, InjectionToken } from '@angular/core';
import { Actions, ofType, createEffect } from '@ngrx/effects';
import { from } from 'rxjs';
import { switchMap, mergeMap, catchError, map } from 'rxjs/operators';
import { Store } from '@ngrx/store';

import {
  loadPublicPlans,
  loadPublicPlansSuccess,
  loadPublicPlansFailure,
  loadMorePublicPlans,
  loadMorePublicPlansSuccess,
  loadMorePublicPlansFailure,
  loadUserInteractions,
  loadUserInteractionsSuccess,
  loadUserInteractionsFailure,
  togglePlanLike,
  togglePlanLikeSuccess,
  togglePlanLikeFailure,
  togglePlanSaved,
  togglePlanSavedSuccess,
  togglePlanSavedFailure,
  markPlanAsPlayed,
  markPlanAsPlayedSuccess,
  markPlanAsPlayedFailure,
} from './public-plans.actions';
import { PublicPlan, PlanInteraction, PublicPlanFilter } from '@cpark/models';
import { getPublicPlansState } from './public-plans.state';
import { AppState } from '../app.state';

export interface IPublicPlansFirestore {
  getPublicPlans(
    filter: PublicPlanFilter,
    limit: number,
    lastPlanUid?: string | null
  ): Promise<{ plans: PublicPlan[]; lastPlanUid: string | null }>;
  getUserPlanInteractions(uidUser: string): Promise<PlanInteraction[]>;
  togglePlanLike(
    uidUser: string,
    planUid: string,
    liked: boolean
  ): Promise<void>;
  markPlanAsPlayed(uidUser: string, planUid: string): Promise<void>;
  togglePlanSaved(
    uidUser: string,
    planUid: string,
    saved: boolean
  ): Promise<void>;
  getPlanInteraction(
    uidUser: string,
    planUid: string
  ): Promise<PlanInteraction | null>;
}

export const PUBLIC_PLANS_FIRESTORE_TOKEN = new InjectionToken<IPublicPlansFirestore>(
  'PUBLIC_PLANS_FIRESTORE_TOKEN'
);

@Injectable()
export class PublicPlansEffects {
  loadPublicPlans$;
  loadMorePublicPlans$;
  loadUserInteractions$;
  togglePlanLike$;
  togglePlanSaved$;
  markPlanAsPlayed$;

  constructor(
    private actions$: Actions,
    private store: Store<AppState>,
    @Inject(PUBLIC_PLANS_FIRESTORE_TOKEN) private firestore: IPublicPlansFirestore
  ) {
    this.loadPublicPlans$ = createEffect(() =>
      this.actions$.pipe(
        ofType(loadPublicPlans),
        switchMap(({ filter, limit }) =>
          from(this.firestore.getPublicPlans(filter, limit)).pipe(
            map(({ plans, lastPlanUid }) => {
              // Limpiar planes antes de despachar la acción para evitar problemas de congelación
              const cleanedPlans = plans.map(plan => 
                JSON.parse(JSON.stringify(plan)) as PublicPlan
              );
              return { plans: cleanedPlans, lastPlanUid };
            }),
            mergeMap(({ plans, lastPlanUid }) => [
              loadPublicPlansSuccess({
                plans,
                lastPlanUid,
                hasMore: plans.length === limit,
              }),
            ]),
            catchError((error) => {
              console.error('Error loading public plans', error);
              return [
                loadPublicPlansFailure({
                  error: error.message || 'Error loading public plans',
                }),
              ];
            })
          )
        )
      )
    );

    this.loadMorePublicPlans$ = createEffect(() =>
      this.actions$.pipe(
        ofType(loadMorePublicPlans),
        switchMap(() =>
          this.store.select(getPublicPlansState).pipe(
            map((state) => ({
              filter: state.filter,
              limit: 20,
              lastPlanUid: state.lastPlanUid,
            })),
            switchMap(({ filter, limit, lastPlanUid }) =>
              from(
                this.firestore.getPublicPlans(filter, limit, lastPlanUid)
              ).pipe(
                map(({ plans, lastPlanUid: newLastPlanUid }) => {
                  // Limpiar planes antes de despachar la acción para evitar problemas de congelación
                  const cleanedPlans = plans.map(plan => 
                    JSON.parse(JSON.stringify(plan)) as PublicPlan
                  );
                  return { plans: cleanedPlans, lastPlanUid: newLastPlanUid };
                }),
                mergeMap(({ plans, lastPlanUid: newLastPlanUid }) => [
                  loadMorePublicPlansSuccess({
                    plans,
                    lastPlanUid: newLastPlanUid,
                    hasMore: plans.length === limit,
                  }),
                ]),
                catchError((error) => {
                  console.error('Error loading more public plans', error);
                  return [
                    loadMorePublicPlansFailure({
                      error: error.message || 'Error loading more public plans',
                    }),
                  ];
                })
              )
            )
          )
        )
      )
    );

    this.loadUserInteractions$ = createEffect(() =>
      this.actions$.pipe(
        ofType(loadUserInteractions),
        switchMap(({ uidUser }) =>
          from(this.firestore.getUserPlanInteractions(uidUser)).pipe(
            mergeMap((interactions) => [
              loadUserInteractionsSuccess({ interactions }),
            ]),
            catchError((error) => {
              console.error('Error loading user interactions', error);
              return [
                loadUserInteractionsFailure({
                  error: error.message || 'Error loading user interactions',
                }),
              ];
            })
          )
        )
      )
    );

    this.togglePlanLike$ = createEffect(() =>
      this.actions$.pipe(
        ofType(togglePlanLike),
        switchMap(({ uidUser, planUid, liked }) =>
          from(
            this.firestore.togglePlanLike(uidUser, planUid, liked)
          ).pipe(
            switchMap(() =>
              from(
                this.firestore.getPlanInteraction(uidUser, planUid)
              ).pipe(
                mergeMap((interaction) => {
                  if (!interaction) {
                    throw new Error('Interaction not found');
                  }
                  return [
                    togglePlanLikeSuccess({
                      planUid,
                      liked,
                      interaction,
                    }),
                  ];
                }),
                catchError((error) => {
                  console.error('Error toggling plan like', error);
                  return [
                    togglePlanLikeFailure({
                      error: error.message || 'Error toggling plan like',
                    }),
                  ];
                })
              )
            ),
            catchError((error) => {
              console.error('Error toggling plan like', error);
              return [
                togglePlanLikeFailure({
                  error: error.message || 'Error toggling plan like',
                }),
              ];
            })
          )
        )
      )
    );

    this.togglePlanSaved$ = createEffect(() =>
      this.actions$.pipe(
        ofType(togglePlanSaved),
        switchMap(({ uidUser, planUid, saved }) =>
          from(
            this.firestore.togglePlanSaved(uidUser, planUid, saved)
          ).pipe(
            switchMap(() =>
              from(
                this.firestore.getPlanInteraction(uidUser, planUid)
              ).pipe(
                mergeMap((interaction) => {
                  if (!interaction) {
                    throw new Error('Interaction not found');
                  }
                  return [
                    togglePlanSavedSuccess({
                      planUid,
                      saved,
                      interaction,
                    }),
                  ];
                }),
                catchError((error) => {
                  console.error('Error toggling plan saved', error);
                  return [
                    togglePlanSavedFailure({
                      error: error.message || 'Error toggling plan saved',
                    }),
                  ];
                })
              )
            ),
            catchError((error) => {
              console.error('Error toggling plan saved', error);
              return [
                togglePlanSavedFailure({
                  error: error.message || 'Error toggling plan saved',
                }),
              ];
            })
          )
        )
      )
    );

    this.markPlanAsPlayed$ = createEffect(() =>
      this.actions$.pipe(
        ofType(markPlanAsPlayed),
        switchMap(({ uidUser, planUid }) =>
          from(
            this.firestore.markPlanAsPlayed(uidUser, planUid)
          ).pipe(
            switchMap(() =>
              from(
                this.firestore.getPlanInteraction(uidUser, planUid)
              ).pipe(
                mergeMap((interaction) => {
                  if (!interaction) {
                    throw new Error('Interaction not found');
                  }
                  return [
                    markPlanAsPlayedSuccess({
                      planUid,
                      interaction,
                    }),
                  ];
                }),
                catchError((error) => {
                  console.error('Error marking plan as played', error);
                  return [
                    markPlanAsPlayedFailure({
                      error: error.message || 'Error marking plan as played',
                    }),
                  ];
                })
              )
            ),
            catchError((error) => {
              console.error('Error marking plan as played', error);
              return [
                markPlanAsPlayedFailure({
                  error: error.message || 'Error marking plan as played',
                }),
              ];
            })
          )
        )
      )
    );
  }
}
