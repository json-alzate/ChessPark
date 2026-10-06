import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { map } from 'rxjs/operators';
import { AppState } from '../app.state';
import { PublicPlanFilter } from '@cpark/models';
import {
  PublicPlansState,
  getPublicPlansState,
} from './public-plans.state';
import {
  loadPublicPlans,
  loadMorePublicPlans,
  setPublicPlansFilter,
  loadUserInteractions,
  loadInteractionPlans,
  loadPlanInteraction,
  togglePlanLike,
  togglePlanSaved,
  markPlanAsPlayed,
  clearPublicPlansError,
} from './public-plans.actions';
import {
  getAllPublicPlans,
  getPublicPlansLoading,
  getPublicPlansLoadingMore,
  getPublicPlansError,
  getPublicPlansFilter,
  getPublicPlansHasMore,
  getUserInteractions,
  getLoadingInteractions,
  getUserLikedPlans,
  getUserPlayedPlans,
  getUserSavedPlans,
  getPublicPlan,
  getInteractionPlans,
  getUserInteractionByPlan,
} from './public-plans.selectors';

/**
 * Fachada de la pantalla de planes públicos y sus interacciones (like, guardado,
 * jugado). Es el único punto por el que los componentes leen o escriben estos
 * datos; ningún componente consulta Firestore directamente.
 *
 * Métodos de lectura: listado público paginado, planes de la pestaña
 * "Interacciones" (por uid), e interacción de un usuario con un plan.
 * Métodos de escritura: loadPublicPlans, togglePlanLike/Saved, markPlanAsPlayed.
 *
 * Consumido por: PublicPlansComponent, PlanPlayedComponent, y los guards de
 * public-plans (que cargan las interacciones del usuario al entrar).
 */
@Injectable({ providedIn: 'root' })
export class PublicPlansFacadeService {
  constructor(private store: Store<AppState>) {}

  // Acciones
  loadPublicPlans(filter: PublicPlanFilter, limit: number) {
    this.store.dispatch(loadPublicPlans({ filter, limit }));
  }

  loadMorePublicPlans() {
    this.store.dispatch(loadMorePublicPlans());
  }

  setFilter(filter: PublicPlanFilter) {
    this.store.dispatch(setPublicPlansFilter({ filter }));
  }

  loadUserInteractions(uidUser: string) {
    this.store.dispatch(loadUserInteractions({ uidUser }));
  }

  togglePlanLike(uidUser: string, planUid: string, liked: boolean) {
    this.store.dispatch(togglePlanLike({ uidUser, planUid, liked }));
  }

  togglePlanSaved(uidUser: string, planUid: string, saved: boolean) {
    this.store.dispatch(togglePlanSaved({ uidUser, planUid, saved }));
  }

  markPlanAsPlayed(uidUser: string, planUid: string) {
    this.store.dispatch(markPlanAsPlayed({ uidUser, planUid }));
  }

  /** Carga planes por uid para la pestaña de interacciones (no toca el listado público). */
  loadInteractionPlans(uids: string[]) {
    this.store.dispatch(loadInteractionPlans({ uids }));
  }

  /** Carga la interacción del usuario con un plan (estado de like en el detalle). */
  loadPlanInteraction(uidUser: string, planUid: string) {
    this.store.dispatch(loadPlanInteraction({ uidUser, planUid }));
  }

  clearError() {
    this.store.dispatch(clearPublicPlansError());
  }

  // Selectores
  getPublicPlans$() {
    return this.store.select(getAllPublicPlans);
  }

  getPublicPlansLoading$() {
    return this.store.select(getPublicPlansLoading);
  }

  getPublicPlansLoadingMore$() {
    return this.store.select(getPublicPlansLoadingMore);
  }

  getPublicPlansError$() {
    return this.store.select(getPublicPlansError);
  }

  getPublicPlansFilter$() {
    return this.store.select(getPublicPlansFilter);
  }

  getPublicPlansHasMore$() {
    return this.store.select(getPublicPlansHasMore);
  }

  getUserInteractions$() {
    return this.store.select(getUserInteractions);
  }

  getLoadingInteractions$() {
    return this.store.select(getLoadingInteractions);
  }

  getUserLikedPlans$() {
    return this.store.select(getUserLikedPlans);
  }

  getUserPlayedPlans$() {
    return this.store.select(getUserPlayedPlans);
  }

  getUserSavedPlans$() {
    return this.store.select(getUserSavedPlans);
  }

  getPublicPlan$(uid: string) {
    return this.store.select(getPublicPlan(uid));
  }

  getInteractionPlans$(uids: string[]) {
    return this.store.select(getInteractionPlans(uids));
  }

  getUserInteractionByPlan$(planUid: string) {
    return this.store.select(getUserInteractionByPlan(planUid));
  }
}
