import { createFeatureSelector } from '@ngrx/store';
import { EntityState, EntityAdapter, createEntityAdapter } from '@ngrx/entity';

/** Models **/
import { PlanElos } from '@models/planElos.model';

export type PlansElosState = EntityState<PlanElos>;

export const planElosStateAdapter: EntityAdapter<PlanElos> = createEntityAdapter<PlanElos>({
    selectId: (planElos) => planElos.uid
});

export const getPlansElosState = createFeatureSelector<PlansElosState>('plansElos');
