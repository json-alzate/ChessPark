import { createReducer, on, Action } from '@ngrx/store';
import {
    PublicPlansState,
    publicPlansStateAdapter,
} from './public-plans.state';
import {
    loadPublicPlans,
    loadPublicPlansSuccess,
    loadPublicPlansFailure,
    loadMorePublicPlans,
    loadMorePublicPlansSuccess,
    loadMorePublicPlansFailure,
    setPublicPlansFilter,
    loadUserInteractions,
    loadUserInteractionsSuccess,
    loadUserInteractionsFailure,
    togglePlanLikeSuccess,
    togglePlanSavedSuccess,
    markPlanAsPlayedSuccess,
    clearPublicPlansError,
} from './public-plans.actions';
import { PublicPlan, Block } from '@cpark/models';

export const initialPublicPlansState: PublicPlansState =
    publicPlansStateAdapter.getInitialState({
        loading: false,
        loadingMore: false,
        error: null,
        filter: 'recent',
        lastPlanUid: null,
        hasMore: true,
        interactions: [],
        loadingInteractions: false,
    });

const _publicPlansReducer = createReducer(
    initialPublicPlansState,
    on(loadPublicPlans, (state, { filter }) => ({
        ...state,
        loading: true,
        error: null,
        filter,
        lastPlanUid: null,
        hasMore: true,
    })),
    on(loadPublicPlansSuccess, (state, { plans, lastPlanUid, hasMore }) => {
        // Limpiar planes antes de guardarlos en el estado para evitar problemas de congelación
        // Usar una función helper para limpiar cada plan individualmente
        const cleanPlan = (plan: PublicPlan): PublicPlan => {
            // Crear un objeto completamente nuevo usando Object.assign con objetos vacíos
            const cleaned: any = {};

            // Copiar propiedades primitivas directamente
            cleaned.uid = String(plan.uid || '');
            cleaned.title = plan.title ? String(plan.title) : undefined;
            cleaned.uidUser = plan.uidUser ? String(plan.uidUser) : undefined;
            cleaned.eloTotal = typeof plan.eloTotal === 'number' ? plan.eloTotal : undefined;
            cleaned.createdAt = typeof plan.createdAt === 'number' ? plan.createdAt : Date.now();
            cleaned.planType = String(plan.planType || 'custom');
            cleaned.isFinished = plan.isFinished === true;
            cleaned.uidCustomPlan = plan.uidCustomPlan ? String(plan.uidCustomPlan) : undefined;
            cleaned.isPublic = plan.isPublic === true;
            cleaned.timesPlayed = typeof (plan as any).timesPlayed === 'number' ? (plan as any).timesPlayed : 0;
            cleaned.likesCount = typeof (plan as any).likesCount === 'number' ? (plan as any).likesCount : 0;
            cleaned.savedCount = typeof (plan as any).savedCount === 'number' ? (plan as any).savedCount : 0;
            cleaned.lastPlayedAt = typeof (plan as any).lastPlayedAt === 'number' ? (plan as any).lastPlayedAt : undefined;

            // Limpiar bloques
            cleaned.blocks = Array.isArray(plan.blocks) ? plan.blocks.map((block: Block) => {
                const cleanBlock: any = {};
                cleanBlock.title = block.title ? String(block.title) : undefined;
                cleanBlock.description = block.description ? String(block.description) : undefined;
                cleanBlock.time = typeof block.time === 'number' ? block.time : -1;
                cleanBlock.puzzlesCount = typeof block.puzzlesCount === 'number' ? block.puzzlesCount : 0;
                cleanBlock.theme = String(block.theme || '');
                cleanBlock.openingFamily = block.openingFamily ? String(block.openingFamily) : undefined;
                cleanBlock.elo = typeof block.elo === 'number' ? block.elo : 1500;
                cleanBlock.color = ['white', 'black', 'random'].includes(block.color) ? block.color : 'random';
                cleanBlock.puzzleTimes = block.puzzleTimes ? {
                    warningOn: typeof block.puzzleTimes.warningOn === 'number' ? block.puzzleTimes.warningOn : -1,
                    dangerOn: typeof block.puzzleTimes.dangerOn === 'number' ? block.puzzleTimes.dangerOn : -1,
                    total: typeof block.puzzleTimes.total === 'number' ? block.puzzleTimes.total : -1
                } : undefined;
                cleanBlock.puzzlesPlayed = []; // Siempre array vacío
                cleanBlock.showPuzzleSolution = block.showPuzzleSolution === true;
                cleanBlock.nextPuzzleImmediately = block.nextPuzzleImmediately === true;
                cleanBlock.goshPuzzle = block.goshPuzzle === true;
                cleanBlock.goshPuzzleTime = typeof block.goshPuzzleTime === 'number' ? block.goshPuzzleTime : undefined;

                // Eliminar propiedades undefined
                Object.keys(cleanBlock).forEach(key => {
                    if (cleanBlock[key] === undefined) {
                        delete cleanBlock[key];
                    }
                });

                return cleanBlock;
            }) : [];

            // Eliminar propiedades undefined
            Object.keys(cleaned).forEach(key => {
                if (cleaned[key] === undefined) {
                    delete cleaned[key];
                }
            });

            return cleaned as PublicPlan;
        };

        const cleanedPlans = plans.map(cleanPlan);

        // Usar setAll con los planes limpios
        const newState = publicPlansStateAdapter.setAll(cleanedPlans, state);
        return {
            ...newState,
            loading: false,
            lastPlanUid,
            hasMore,
        };
    }),
    on(loadPublicPlansFailure, (state, { error }) => ({
        ...state,
        loading: false,
        error,
    })),
    on(loadMorePublicPlans, (state) => ({
        ...state,
        loadingMore: true,
        error: null,
    })),
    on(loadMorePublicPlansSuccess, (state, { plans, lastPlanUid, hasMore }) => {
        // Limpiar planes antes de guardarlos en el estado para evitar problemas de congelación
        const cleanedPlans = plans.map(plan => {
            // Crear un objeto completamente nuevo y plano
            return JSON.parse(JSON.stringify(plan)) as PublicPlan;
        });
        return {
            ...publicPlansStateAdapter.addMany(cleanedPlans, state),
            loadingMore: false,
            lastPlanUid,
            hasMore,
        };
    }),
    on(loadMorePublicPlansFailure, (state, { error }) => ({
        ...state,
        loadingMore: false,
        error,
    })),
    on(setPublicPlansFilter, (state, { filter }) => ({
        ...state,
        filter,
    })),
    on(loadUserInteractions, (state) => ({
        ...state,
        loadingInteractions: true,
    })),
    on(loadUserInteractionsSuccess, (state, { interactions }) => ({
        ...state,
        interactions,
        loadingInteractions: false,
    })),
    on(loadUserInteractionsFailure, (state) => ({
        ...state,
        loadingInteractions: false,
    })),
    on(togglePlanLikeSuccess, (state, { planUid, liked, interaction }) => {
        const plan = state.entities[planUid];
        if (!plan) return state;

        const updatedPlan = {
            ...plan,
            likesCount: liked ? plan.likesCount + 1 : Math.max(0, plan.likesCount - 1),
            userInteraction: {
                ...plan.userInteraction,
                ...interaction,
            },
        };

        const updatedInteractions = state.interactions.some((i) => i.planUid === planUid)
            ? state.interactions.map((i) =>
                i.planUid === planUid ? interaction : i
            )
            : [...state.interactions, interaction];

        return {
            ...publicPlansStateAdapter.updateOne(
                { id: planUid, changes: updatedPlan },
                state
            ),
            interactions: updatedInteractions,
        };
    }),
    on(togglePlanSavedSuccess, (state, { planUid, saved, interaction }) => {
        const plan = state.entities[planUid];
        if (!plan) return state;

        const updatedPlan = {
            ...plan,
            savedCount: saved ? plan.savedCount + 1 : Math.max(0, plan.savedCount - 1),
            userInteraction: {
                ...plan.userInteraction,
                ...interaction,
            },
        };

        const updatedInteractions = state.interactions.some((i) => i.planUid === planUid)
            ? state.interactions.map((i) =>
                i.planUid === planUid ? interaction : i
            )
            : [...state.interactions, interaction];

        return {
            ...publicPlansStateAdapter.updateOne(
                { id: planUid, changes: updatedPlan },
                state
            ),
            interactions: updatedInteractions,
        };
    }),
    on(markPlanAsPlayedSuccess, (state, { planUid, interaction }) => {
        const plan = state.entities[planUid];
        if (!plan) return state;

        const wasPlayed = plan.userInteraction?.played ?? false;
        const updatedPlan = {
            ...plan,
            timesPlayed: wasPlayed ? plan.timesPlayed : plan.timesPlayed + 1,
            lastPlayedAt: Date.now(),
            userInteraction: {
                ...plan.userInteraction,
                ...interaction,
            },
        };

        const updatedInteractions = state.interactions.some((i) => i.planUid === planUid)
            ? state.interactions.map((i) =>
                i.planUid === planUid ? interaction : i
            )
            : [...state.interactions, interaction];

        return {
            ...publicPlansStateAdapter.updateOne(
                { id: planUid, changes: updatedPlan },
                state
            ),
            interactions: updatedInteractions,
        };
    }),
    on(clearPublicPlansError, (state) => ({
        ...state,
        error: null,
    }))
);

export function publicPlansReducer(
    state: PublicPlansState | undefined,
    action: Action
) {
    return _publicPlansReducer(state, action);
}
