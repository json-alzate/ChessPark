import { createFeatureSelector } from '@ngrx/store';

import { Profile } from '@models/profile.model';

export interface AuthState {
    profile: Profile | null;
    errorLogin: string | null;
    errorRegister: string | null;
}

export const getAuthState = createFeatureSelector<AuthState>('auth');
