import { Injectable, Inject, InjectionToken } from '@angular/core';
import { Actions, ofType, createEffect } from '@ngrx/effects';
import { from, merge } from 'rxjs';
import { switchMap, catchError, mergeMap } from 'rxjs/operators';

import {
    requestLoginGoogle,
    logOut,
    requestSingUpEmail,
    requestLoginEmail,
    setErrorLogin,
    requestUpdateProfile,
    addNewNickName,
    updateProfile
} from './auth.actions';

/**
 * Interface para el servicio de autenticación que debe ser proporcionado por la app
 * La app debe implementar esta interface y proveer el servicio mediante injection token
 */
export interface IAuthService {
    loginGoogle(): Promise<unknown>;
    createUserWithEmailAndPassword(email: string, password: string): Promise<unknown>;
    signInWithEmailAndPassword(email: string, password: string): Promise<unknown>;
    logout(): unknown; // Observable o Promise
}

/**
 * Interface para el servicio de perfil que debe ser proporcionado por la app
 * La app debe implementar esta interface y proveer el servicio mediante injection token
 */
export interface IProfileService {
    updateProfile(profile: unknown): Promise<void>;
    addNewNickName(nickname: string, uidUser: string): Promise<void>;
}

// Injection tokens para los servicios
export const AUTH_SERVICE_TOKEN = new InjectionToken<IAuthService>('AUTH_SERVICE_TOKEN');
export const PROFILE_SERVICE_TOKEN = new InjectionToken<IProfileService>('PROFILE_SERVICE_TOKEN');

@Injectable()
export class AuthEffects {

    requestLoginGoogle$;
    requestSingUpEmail$;
    requestLoginEmail$;
    logout$;
    requestUpdateProfile$;
    addNewNickName$;

    constructor(
        private actions$: Actions,
        @Inject(AUTH_SERVICE_TOKEN) private authService: IAuthService,
        @Inject(PROFILE_SERVICE_TOKEN) private profileService: IProfileService
    ) {
        this.requestLoginGoogle$ = createEffect(() =>
            this.actions$.pipe(
            ofType(requestLoginGoogle),
            mergeMap(() =>
                from(this.authService.loginGoogle()).pipe(
                    mergeMap(() => []),
                    catchError(() => merge([
                        setErrorLogin({ error: 'LoginError' })
                    ]))
                )
            )
        ));

        this.requestSingUpEmail$ = createEffect(() =>
        this.actions$.pipe(
            ofType(requestSingUpEmail),
            mergeMap((data) =>
                from(this.authService.createUserWithEmailAndPassword(data.email, data.password)).pipe(
                    mergeMap(() => [])
                )
            )
        ),
        { dispatch: false });

        this.requestLoginEmail$ = createEffect(() =>
        this.actions$.pipe(
            ofType(requestLoginEmail),
            mergeMap((data) =>
                from(this.authService.signInWithEmailAndPassword(data.email, data.password)).pipe(
                    mergeMap(() => []),
                    catchError(() => merge([
                        setErrorLogin({ error: 'LoginError' })
                    ]))
                )
            )
        ));

        this.logout$ = createEffect(() =>
        this.actions$.pipe(
            ofType(logOut),
            switchMap(() => {
                const logoutResult: any = this.authService.logout();
                // Convertir a Observable si es Promise
                const logoutObservable = logoutResult instanceof Promise 
                    ? from(logoutResult) 
                    : logoutResult;
                return (logoutObservable as any).pipe(
                    mergeMap(() => [])
                );
            })
        ),
        { dispatch: false });

        this.requestUpdateProfile$ = createEffect(() =>
        this.actions$.pipe(
            ofType(requestUpdateProfile),
            mergeMap((data) =>
                from(this.profileService.updateProfile(data.profile) as Promise<void>).pipe(
                    mergeMap(() => [
                        updateProfile({ profile: data.profile })
                    ])
                )
            )
        ));

        this.addNewNickName$ = createEffect(() =>
        this.actions$.pipe(
            ofType(addNewNickName),
            mergeMap((data) =>
                from(this.profileService.addNewNickName(data.nickname, data.uidUser) as Promise<void>).pipe(
                    mergeMap(() => [])
                )
            )
        ),
        { dispatch: false });
    }
}

