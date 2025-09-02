import { createSelector } from '@ngrx/store';

import { getAuthState } from '@redux/states/auth.state';

export const getProfile = createSelector(
    getAuthState,
    authState => authState.profile
);

export const getErrorLogin = createSelector(
    getAuthState,
    authState => authState.errorLogin
);

export const getErrorRegister = createSelector(
    getAuthState,
    authState => authState.errorRegister
);
