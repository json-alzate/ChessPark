import { ActionReducerMap, MetaReducer } from '@ngrx/store';

import * as fromRouter from '@ngrx/router-store';

// reducers
import { authReducer } from './auth';

// states
import { AppState } from './app.state';
import { planReducer } from './plan';
import { plansElosReducer } from './plansElos';

// models

export const appReducers: ActionReducerMap<AppState> = {
  auth: authReducer,
  router: fromRouter.routerReducer,
  plan: planReducer,
  plansElos: plansElosReducer,
};

export const metaReducers: MetaReducer<AppState>[] = [];
