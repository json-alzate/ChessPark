import { createFeatureSelector } from '@ngrx/store';
import { EntityState, EntityAdapter, createEntityAdapter } from '@ngrx/entity';

import { PlanElos } from '@cpark/models';

export type PlansElosState = EntityState<PlanElos>;

export const planElosStateAdapter: EntityAdapter<PlanElos> = createEntityAdapter<PlanElos>({
  selectId: (planElos) => planElos.uid
});

export const getPlansElosState = createFeatureSelector<PlansElosState>('plansElos');
