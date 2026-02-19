import { createFeatureSelector } from '@ngrx/store';
import { EntityState, EntityAdapter, createEntityAdapter } from '@ngrx/entity';

import { Plan } from '@cpark/models';

export type CustomPlansState = EntityState<Plan> & {
  loading: boolean;
};

export const customPlansStateAdapter: EntityAdapter<Plan> =
  createEntityAdapter<Plan>({
    selectId: (plan) => plan.uid,
  });

export const getCustomPlansState =
  createFeatureSelector<CustomPlansState>('customPlans');
