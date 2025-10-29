import { createFeatureSelector } from '@ngrx/store';

export interface PlanState {
  data: any; // TODO: Reemplazar 'any' con el tipo específico cuando se cree el modelo

  loadingPlan: boolean;
  error: string | null;
}

export const getPlanState = createFeatureSelector<PlanState>('plan');
