import { createFeatureSelector } from '@ngrx/store';
import { Profile } from '@cpark/models';

export interface AuthState {
    profile: Profile | null;
    errorLogin: string | null;
    errorRegister: string | null;
    isInitialized: boolean;
}

export const getAuthState = createFeatureSelector<AuthState>('auth');

