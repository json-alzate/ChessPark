import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { PlansElosState } from './plansElos.state';

import {
  requestLoadPlansElos,
  requestAddOnePlanElo,
  requestUpdatePlanElos,
} from './plansElos.actions';
import { getAllPlansElos, getPlanElo } from './plansElos.selectors';
import { PlanElos } from '@cpark/models';

/**
 * Fachada fina para el estado plansElos: solo dispatch de acciones y selectores.
 * La lógica de negocio (cálculo de elos tras un puzzle) vive en PlansElosService (app).
 */
@Injectable({ providedIn: 'root' })
export class PlansElosFacadeService {
  private store = inject(Store<PlansElosState>);

  // Acciones
  requestLoadPlansElos(uidUser: string) {
    this.store.dispatch(requestLoadPlansElos({ uidUser }));
  }

  requestAddOnePlanElo(planElo: PlanElos) {
    this.store.dispatch(requestAddOnePlanElo({ planElo }));
  }

  requestUpdatePlanElos(planElo: PlanElos) {
    this.store.dispatch(requestUpdatePlanElos({ planElo }));
  }

  // Selectores
  getAllPlansElos$() {
    return this.store.select(getAllPlansElos);
  }

  getPlanElo$(uidPlan: string) {
    return this.store.select(getPlanElo(uidPlan));
  }
}
