import { Injectable } from '@angular/core';
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
} from '@redux/actions/auth.actions';


import { AuthService } from '@services/auth.service';
import { ProfileService } from '@services/profile.service';

@Injectable()
export class AuthEffects {


    requestLoginGoogle$ = createEffect(() =>
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
        )
    );


    requestSingUpEmail$ = createEffect(() =>
        this.actions$.pipe(
            ofType(requestSingUpEmail),
            mergeMap((data) =>
                from(this.authService.createUserWithEmailAndPassword(data.email, data.password)).pipe(
                    mergeMap(() => [])
                )
            )
        )
    );


    requestLoginEmail$ = createEffect(() =>
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
        )
    );


    logout$ = createEffect(() =>
        this.actions$.pipe(
            ofType(logOut),
            switchMap(() =>
                this.authService.logout().pipe(
                    mergeMap(() => [])
                )
            )
        )

    );


    requestUpdateProfile$ = createEffect(() =>
        this.actions$.pipe(
            ofType(requestUpdateProfile),
            mergeMap((data) =>
                from(this.profileService.updateProfile(data.profile)).pipe(
                    mergeMap(() => [
                        updateProfile({ profile: data.profile })
                    ]),
                    catchError(() => merge([
                        // TODO: mostrar un error
                    ]))
                )
            )
        )
    );


    addNewNickName$ = createEffect(() =>
        this.actions$.pipe(
            ofType(addNewNickName),
            mergeMap((data) =>
                from(this.profileService.addNewNickName(data.nickname, data.uidUser)).pipe(
                    mergeMap(() => []),
                    catchError(() => merge([
                    ]))
                )
            )
        )
    );

    constructor(
        private actions$: Actions,
        private authService: AuthService,
        private profileService: ProfileService
    ) { }

}
