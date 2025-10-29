import { createFeatureSelector } from '@ngrx/store';
import { Plan } from '@cpark/models';

export interface PlanState {
  plan: Plan | null;
  loadingPlan: boolean;
  error: string | null;
}

export const getPlanState = createFeatureSelector<PlanState>('plan');
