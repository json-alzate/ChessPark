import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { PlanState } from './plan.state';

import { loadPlan, clearPlanError, updatePlan } from './plan.actions';
import { getPlanState } from './plan.state';
import { map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class PlanFacadeService {
  constructor(private store: Store<PlanState>) {}

  // Acciones
  loadPlan() {
    this.store.dispatch(loadPlan());
  }

  clearError() {
    this.store.dispatch(clearPlanError());
  }

  updatePlan(data: any) {
    // Reemplazar 'any' con el tipo específico
    this.store.dispatch(updatePlan({ data }));
  }

  // Selectores
  getPlan$() {
    return this.store.select(getPlanState).pipe(map((state) => state.data));
  }

  getLoadingPlan$() {
    return this.store
      .select(getPlanState)
      .pipe(map((state) => state.loadingPlan));
  }

  getError$() {
    return this.store.select(getPlanState).pipe(map((state) => state.error));
  }
}
