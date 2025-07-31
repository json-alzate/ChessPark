import { createSelector } from '@ngrx/store';
import { getPlansHistoryState, plansHistoryStateAdapter } from '@redux/states/plans-history.state';


export const {
    selectAll: getAllPlansHistory,
    selectTotal: getCountAllPlansHistory,
    selectEntities: getPlansHistoryEntities
} = plansHistoryStateAdapter.getSelectors(getPlansHistoryState);

export const getPlansHistoryOrderByDate = createSelector(
    getAllPlansHistory,
    (plans) => plans.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
);
