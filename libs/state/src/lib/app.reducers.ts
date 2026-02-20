import { ActionReducerMap, MetaReducer } from '@ngrx/store';

import * as fromRouter from '@ngrx/router-store';

// reducers
import { authReducer } from './auth';

// states
import { AppState } from './app.state';
import { planReducer } from './plan';
import { plansElosReducer } from './plansElos';
import { customPlansReducer } from './customPlans';
import { publicPlansReducer } from './public-plans';

// models

export const appReducers: ActionReducerMap<AppState> = {
  auth: authReducer,
  router: fromRouter.routerReducer,
  plan: planReducer,
  plansElos: plansElosReducer,
  customPlans: customPlansReducer,
  publicPlans: publicPlansReducer,
};

export const metaReducers: MetaReducer<AppState>[] = [];
