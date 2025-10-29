import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { map } from 'rxjs/operators';

import { Plan } from '@cpark/models';
import { PlanState, getPlanState } from './plan.state';
import { loadPlan, clearPlanError, updatePlan } from './plan.actions';

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

  updatePlan(plan: Plan) {
    this.store.dispatch(updatePlan({ plan }));
  }

  // Selectores
  getPlan$() {
    return this.store.select(getPlanState).pipe(map((state) => state.plan || null));
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
