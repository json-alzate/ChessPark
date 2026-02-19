import { RouterReducerState } from '@ngrx/router-store';
import { RouterStateUrl } from './router.state';

// models

// states
import { AuthState } from './auth';
import { PlanState } from './plan';
import { PlansElosState } from './plansElos';
import { CustomPlansState } from './customPlans';

export interface AppState {
  router: RouterReducerState<RouterStateUrl>;
  auth: AuthState;
  plan: PlanState;
  plansElos: PlansElosState;
  customPlans: CustomPlansState;
}
