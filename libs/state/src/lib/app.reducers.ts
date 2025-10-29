import { ActionReducerMap, MetaReducer } from '@ngrx/store';

import * as fromRouter from '@ngrx/router-store';

// reducers
import { authReducer } from './auth';


// states
import { AppState } from './app.state';
import { planReducer } from './plan';


// models

export const appReducers: ActionReducerMap<AppState> = {
  auth: authReducer,
  router: fromRouter.routerReducer,
  plan: planReducer,
};

export const metaReducers: MetaReducer<AppState>[] = [];
