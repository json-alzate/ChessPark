import { Action, ActionReducer, ActionReducerMap, MetaReducer } from '@ngrx/store';

import { environment } from '@environments/environment';

import * as fromRouter from '@ngrx/router-store';

// reducers
import { uiReducer } from '@redux/reducers/ui.reducer';
import { authReducer } from '@redux/reducers/auth.reducer';
import { coordinatesPuzzleReducer } from '@redux/reducers/coordinates-puzzles.reducer';
import { puzzlesReducer } from '@redux/reducers/puzzles.reducer';
import { userPuzzlesReducer } from '@redux/reducers/user-puzzles.reducer';
import { planReducer } from '@redux/reducers/plan.reducer';
import { plansHistoryReducer } from '@redux/reducers/plans-history.reducer';
import { plansElosReducer } from '@redux/reducers/plans-elos.reducer';
import { customPlansReducer } from '@redux/reducers/custom-plans.reducer';


// states
import { AppState } from '@redux/states/app.state';


import { LOGOUT } from '@redux/actions/auth.actions';

// models



export const appReducers: ActionReducerMap<AppState> = {
    ui: uiReducer,
    auth: authReducer,
    router: fromRouter.routerReducer,
    coordinatesPuzzles: coordinatesPuzzleReducer,
    puzzles: puzzlesReducer,
    userPuzzles: userPuzzlesReducer,
    plan: planReducer,
    plansHistory: plansHistoryReducer,
    plansElos: plansElosReducer,
    customPlans: customPlansReducer
};

export const metaReducers: MetaReducer<AppState>[] = !environment.production ? [] : [];

export const clearStateMetaReducer =
    <State extends unknown>(reducer: ActionReducer<State>): ActionReducer<State> => (state: State, action: Action) => {
        if (action.type === LOGOUT) {
            state = {} as State; // ==> Emptying state here
        }
        return reducer(state, action);
    };



