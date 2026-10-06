import { createAction, props } from '@ngrx/store';
import { PublicPlan, PlanInteraction, PublicPlanFilter } from '@cpark/models';

// Load public plans
export const loadPublicPlans = createAction(
  '[PublicPlans] Load Public Plans',
  props<{ filter: PublicPlanFilter; limit: number }>()
);

export const loadPublicPlansSuccess = createAction(
  '[PublicPlans] Load Public Plans Success',
  props<{ plans: PublicPlan[]; lastPlanUid: string | null; hasMore: boolean }>()
);

export const loadPublicPlansFailure = createAction(
  '[PublicPlans] Load Public Plans Failure',
  props<{ error: string }>()
);

// Load more public plans
export const loadMorePublicPlans = createAction(
  '[PublicPlans] Load More Public Plans'
);

export const loadMorePublicPlansSuccess = createAction(
  '[PublicPlans] Load More Public Plans Success',
  props<{ plans: PublicPlan[]; lastPlanUid: string | null; hasMore: boolean }>()
);

export const loadMorePublicPlansFailure = createAction(
  '[PublicPlans] Load More Public Plans Failure',
  props<{ error: string }>()
);

// Set filter
export const setPublicPlansFilter = createAction(
  '[PublicPlans] Set Filter',
  props<{ filter: PublicPlanFilter }>()
);

// Load user interactions
export const loadUserInteractions = createAction(
  '[PublicPlans] Load User Interactions',
  props<{ uidUser: string }>()
);

export const loadUserInteractionsSuccess = createAction(
  '[PublicPlans] Load User Interactions Success',
  props<{ interactions: PlanInteraction[] }>()
);

export const loadUserInteractionsFailure = createAction(
  '[PublicPlans] Load User Interactions Failure',
  props<{ error: string }>()
);

// Load planes sueltos por uid (pestaña "Interacciones")
export const loadInteractionPlans = createAction(
  '[PublicPlans] Load Interaction Plans',
  props<{ uids: string[] }>()
);

export const loadInteractionPlansSuccess = createAction(
  '[PublicPlans] Load Interaction Plans Success',
  props<{ plans: PublicPlan[] }>()
);

// Load la interacción de un usuario con un plan (estado de "me gusta" en el detalle)
export const loadPlanInteraction = createAction(
  '[PublicPlans] Load Plan Interaction',
  props<{ uidUser: string; planUid: string }>()
);

export const loadPlanInteractionSuccess = createAction(
  '[PublicPlans] Load Plan Interaction Success',
  props<{ interaction: PlanInteraction | null }>()
);

// Toggle like
export const togglePlanLike = createAction(
  '[PublicPlans] Toggle Plan Like',
  props<{ uidUser: string; planUid: string; liked: boolean }>()
);

export const togglePlanLikeSuccess = createAction(
  '[PublicPlans] Toggle Plan Like Success',
  props<{ planUid: string; liked: boolean; interaction: PlanInteraction }>()
);

export const togglePlanLikeFailure = createAction(
  '[PublicPlans] Toggle Plan Like Failure',
  props<{ error: string }>()
);

// Toggle saved
export const togglePlanSaved = createAction(
  '[PublicPlans] Toggle Plan Saved',
  props<{ uidUser: string; planUid: string; saved: boolean }>()
);

export const togglePlanSavedSuccess = createAction(
  '[PublicPlans] Toggle Plan Saved Success',
  props<{ planUid: string; saved: boolean; interaction: PlanInteraction }>()
);

export const togglePlanSavedFailure = createAction(
  '[PublicPlans] Toggle Plan Saved Failure',
  props<{ error: string }>()
);

// Mark as played
export const markPlanAsPlayed = createAction(
  '[PublicPlans] Mark Plan As Played',
  props<{ uidUser: string; planUid: string }>()
);

export const markPlanAsPlayedSuccess = createAction(
  '[PublicPlans] Mark Plan As Played Success',
  props<{ planUid: string; interaction: PlanInteraction }>()
);

export const markPlanAsPlayedFailure = createAction(
  '[PublicPlans] Mark Plan As Played Failure',
  props<{ error: string }>()
);

// Clear error
export const clearPublicPlansError = createAction(
  '[PublicPlans] Clear Error'
);
