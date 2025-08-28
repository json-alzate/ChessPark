import { createSelector } from '@ngrx/store';

import { getPlanState } from '@redux/states/app.state';

import { Plan } from '@models/plan.model';

export const getPlan = createSelector(
    getPlanState,
    (state: Plan) => state
);
