import { createFeatureSelector } from '@ngrx/store';
import { Profile } from '@chesspark/models';

export interface AuthState {
    profile: Profile | null;
    errorLogin: string | null;
    errorRegister: string | null;
    isInitialized: boolean;
}

export const getAuthState = createFeatureSelector<AuthState>('auth');

