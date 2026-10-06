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
  // Planes sueltos cargados por uid (likes, jugados y guardados). Van aparte de
  // las entidades para no mezclarlos con el listado público que muestra la
  // pestaña "Públicos".
  interactionPlans: Record<string, PublicPlan>;
};

export const publicPlansStateAdapter: EntityAdapter<PublicPlan> =
  createEntityAdapter<PublicPlan>({
    selectId: (plan) => plan.uid,
  });

export const getPublicPlansState =
  createFeatureSelector<PublicPlansState>('publicPlans');
