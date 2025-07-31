import { Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';

import { Plan } from '@models/plan.model';

// State
import { CustomPlansState } from '@redux/states/custom-plans.state';

// Store
import { Store } from '@ngrx/store';

// Actions
import {
  requestAddOneCustomPlan,
  requestGetCustomPlans,
  requestUpdateCustomPlan
} from '@redux/actions/custom-plans.actions';

// Selectors
import { getPlanCustomPlan, getCustomPlansOrderByDate } from '@redux/selectors/custom-plans.selectors';


// services
import { FirestoreService } from '@services/firestore.service';




@Injectable({
  providedIn: 'root'
})
export class CustomPlansService {

  constructor(
    private store: Store<CustomPlansState>,
    private firestoreService: FirestoreService
  ) { }



  requestGetCustomPlansAction(uidUser: string) {
    const action = requestGetCustomPlans({ uidUser });
    this.store.dispatch(action);
  }

  requestGetCustomPlans(uidUser: string) {
    return this.firestoreService.getCustomPlans(uidUser);
  }

  requestUpdateCustomPlan(customPlan: Plan) {
    const action = requestUpdateCustomPlan({ customPlan });
    this.store.dispatch(action);
  }


  updateCustomPlan(customPlan: Plan) {
    return this.firestoreService.updateCustomPlan(customPlan);
  }



  requestAddOneCustomPlan(customPlan: Plan) {
    const action = requestAddOneCustomPlan({ customPlan });
    this.store.dispatch(action);
  }

  saveCustomPlan(plan: Plan) {
    return this.firestoreService.saveCustomPlan(plan);
  }

  /** STATE OBSERVABLES */

  async getOnePlanElo(planUid: string) {
    return await firstValueFrom(this.store.select(getPlanCustomPlan(planUid)));
  }

  getCustomPlansState(): Observable<Plan[]> {
    return this.store.select(getCustomPlansOrderByDate);
  }

}
