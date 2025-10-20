import { createFeatureSelector } from '@ngrx/store';
import { EntityState, EntityAdapter, createEntityAdapter } from '@ngrx/entity';

/** Models **/
import { Plan } from '@models/plan.model';

export type CustomPlansState = EntityState<Plan>;

export const customPlansStateAdapter: EntityAdapter<Plan> = createEntityAdapter<Plan>({
    selectId: (customPlan) => customPlan.uid
});

export const getCustomPlansState = createFeatureSelector<CustomPlansState>('customPlans');
