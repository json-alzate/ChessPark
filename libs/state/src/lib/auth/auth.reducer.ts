import { createReducer, on, Action } from '@ngrx/store';
import { AuthState } from './auth.state';
import {
    setErrorLogin,
    setErrorRegister,
    setProfile,
    updateProfile,
    logOut
} from './auth.actions';

export const initialState: AuthState = {
    profile: null,
    errorLogin: null,
    errorRegister: null
};

export const iauthReducer = createReducer(
    initialState,
    on(setProfile, (state, { profile }) => ({ ...state, profile })),

    on(updateProfile, (state, { profile }) => ({
        ...state,
        profile: state.profile ? { ...state.profile, ...profile } as any : null
    })),

    on(setErrorLogin, (state, { error }) => (
        { ...state, errorLogin: error }
    )),

    on(setErrorRegister, (state, { error }) => (
        { ...state, errorRegister: error }
    )),

    on(logOut, () => initialState)
);

export const authReducer = (state: AuthState | undefined, action: Action) => iauthReducer(state, action);

