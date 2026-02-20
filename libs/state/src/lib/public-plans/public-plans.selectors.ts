import { createSelector } from '@ngrx/store';
import {
  getPublicPlansState,
  publicPlansStateAdapter,
} from './public-plans.state';
import { PublicPlan, PlanInteraction } from '@cpark/models';

export const {
  selectAll: getAllPublicPlans,
  selectTotal: getCountAllPublicPlans,
  selectEntities: getPublicPlansEntities,
} = publicPlansStateAdapter.getSelectors(getPublicPlansState);

export const getPublicPlansLoading = createSelector(
  getPublicPlansState,
  (state) => state?.loading ?? false
);

export const getPublicPlansLoadingMore = createSelector(
  getPublicPlansState,
  (state) => state?.loadingMore ?? false
);

export const getPublicPlansError = createSelector(
  getPublicPlansState,
  (state) => state?.error ?? null
);

export const getPublicPlansFilter = createSelector(
  getPublicPlansState,
  (state) => state?.filter ?? 'recent'
);

export const getPublicPlansHasMore = createSelector(
  getPublicPlansState,
  (state) => state?.hasMore ?? false
);

export const getPublicPlan = (uid: string) =>
  createSelector(getAllPublicPlans, (plans: PublicPlan[]) => {
    if (!plans) return null;
    return plans.find((p) => p.uid === uid) ?? null;
  });

export const getUserInteractions = createSelector(
  getPublicPlansState,
  (state) => state?.interactions ?? []
);

export const getLoadingInteractions = createSelector(
  getPublicPlansState,
  (state) => state?.loadingInteractions ?? false
);

export const getUserLikedPlans = createSelector(
  getUserInteractions,
  (interactions: PlanInteraction[]) => {
    return interactions.filter((i) => i.liked).map((i) => i.planUid);
  }
);

export const getUserPlayedPlans = createSelector(
  getUserInteractions,
  (interactions: PlanInteraction[]) => {
    return interactions.filter((i) => i.played).map((i) => i.planUid);
  }
);

export const getUserSavedPlans = createSelector(
  getUserInteractions,
  (interactions: PlanInteraction[]) => {
    return interactions.filter((i) => i.saved).map((i) => i.planUid);
  }
);
