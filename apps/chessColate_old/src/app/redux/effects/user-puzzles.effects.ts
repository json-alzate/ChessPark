import { Injectable } from '@angular/core';
import { Actions, ofType, createEffect } from '@ngrx/effects';

import { from, merge } from 'rxjs';
import { catchError, mergeMap, map, switchMap } from 'rxjs/operators';

import {
    requestLoadUserPuzzles,
    addUserPuzzles,
    requestAddOneUserPuzzle,
    addOneUserPuzzle
} from '@redux/actions/user-puzzles.actions';

import { requestUpdateProfile } from '@redux/actions/auth.actions';


import { UserPuzzlesService } from '@services/user-puzzles.service';

import { calculateElo } from '@utils/calculate-elo';

@Injectable()
export class UserPuzzlesEffects {

    requestLoadUserPuzzles$ = createEffect(() =>
        this.actions$.pipe(
            ofType(requestLoadUserPuzzles),
            switchMap(({ uidUser }) =>
                from(this.userPuzzlesService.loadUserPuzzles(uidUser)).pipe(
                    mergeMap((userPuzzles) => [
                        addUserPuzzles({ userPuzzles })
                    ])
                ))
        )
    );


    requestAddOneUserPuzzle$ = createEffect(() =>
        this.actions$.pipe(
            ofType(requestAddOneUserPuzzle),
            switchMap(({ userPuzzle }) =>
                from(this.userPuzzlesService.addOneUserPuzzle(userPuzzle)).pipe(
                    mergeMap((docId) => [
                        addOneUserPuzzle({ userPuzzle: { ...userPuzzle, uid: docId } }),
                        requestUpdateProfile({
                            profile: {
                                eloPuzzles: calculateElo(userPuzzle.currentEloUser, userPuzzle.eloPuzzle, userPuzzle.resolved ? 1 : 0)
                            }
                        })
                    ])
                ))
        )
    );



    constructor(
        private actions$: Actions,
        private userPuzzlesService: UserPuzzlesService
    ) { }

}
