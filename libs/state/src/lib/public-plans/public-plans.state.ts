import { createFeatureSelector } from '@ngrx/store';
import { EntityState, EntityAdapter, createEntityAdapter } from '@ngrx/entity';
import { PublicPlan, PlanInteraction, PublicPlanFilter } from '@cpark/models';

export type PublicPlansState = EntityState<PublicPlan> & {
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  filter: PublicPlanFilter;
  lastPlanUid: string | null; // UID del último plan para paginación (en lugar de QueryDocumentSnapshot)
  hasMore: boolean;
  interactions: PlanInteraction[];
  loadingInteractions: boolean;
};

export const publicPlansStateAdapter: EntityAdapter<PublicPlan> =
  createEntityAdapter<PublicPlan>({
    selectId: (plan) => plan.uid,
  });

export const getPublicPlansState =
  createFeatureSelector<PublicPlansState>('publicPlans');
