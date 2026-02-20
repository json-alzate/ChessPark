import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';

import {
  loadCustomPlans,
  addOneCustomPlan,
  updateCustomPlan,
} from './custom-plans.actions';
import {
  getAllCustomPlans,
  getCountAllCustomPlans,
  getCustomPlan,
  getCustomPlansOrderByDate,
  getCustomPlansLoading,
} from './custom-plans.selectors';
import { Plan } from '@cpark/models';

@Injectable({ providedIn: 'root' })
export class CustomPlansFacadeService {
  private store = inject(Store);

  loadCustomPlans(uidUser: string): void {
    this.store.dispatch(loadCustomPlans({ uidUser }));
  }

  addOneCustomPlan(plan: Plan): void {
    this.store.dispatch(addOneCustomPlan({ plan }));
  }

  updateCustomPlanInState(plan: Plan): void {
    this.store.dispatch(updateCustomPlan({ plan: { id: plan.uid, changes: plan } }));
  }

  getAllCustomPlans$(): Observable<Plan[]> {
    return this.store.select(getAllCustomPlans);
  }

  getCustomPlansOrderByDate$(): Observable<Plan[]> {
    return this.store.select(getCustomPlansOrderByDate);
  }

  getCustomPlan$(uid: string): Observable<Plan | null> {
    return this.store.select(getCustomPlan(uid));
  }

  getCountAllCustomPlans$(): Observable<number> {
    return this.store.select(getCountAllCustomPlans);
  }

  getCustomPlansLoading$(): Observable<boolean> {
    return this.store.select(getCustomPlansLoading);
  }
}
