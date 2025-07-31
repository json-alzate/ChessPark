import { createAction, props } from '@ngrx/store';


import { PlanElos } from '@models/planElos.model';
import { Update } from '@ngrx/entity';


export const requestLoadPlansElos = createAction(
    '[PlanElos] requestPlansElos',
    props<{ uidUser: string }>()
);


export const addPlansElos = createAction(
    '[PlanElos] addPlansElos',
    props<{ plansElos: PlanElos[] }>()
);

export const requestAddOnePlanElo = createAction(
    '[PlanElos] requestAddOnePlanElo',
    props<{ planElo: PlanElos }>()
);

export const addOnePlanElo = createAction(
    '[PlanElos] addOnePlanElo',
    props<{ planElo: PlanElos }>()
);

export const requestUpdatePlanElos = createAction(
    '[PlanElos] requestUpdatePlanElos',
    props<{ planElo: PlanElos }>()
);

export const updatePlanElos = createAction(
    '[PlanElos] updatePlanElos',
    props<{ planElo: Update<PlanElos> }>()
);
