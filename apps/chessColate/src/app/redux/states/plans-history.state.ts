import { createFeatureSelector } from '@ngrx/store';
import { EntityState, EntityAdapter, createEntityAdapter } from '@ngrx/entity';

/** Models **/
import { Plan } from '@models/plan.model';

export type PlansHistoryState = EntityState<Plan>;

export const plansHistoryStateAdapter: EntityAdapter<Plan> = createEntityAdapter<Plan>({
    selectId: (plansHistory) => plansHistory.uid
});

export const getPlansHistoryState = createFeatureSelector<PlansHistoryState>('plansHistory');
