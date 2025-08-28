import { Injectable } from '@angular/core';




import { Store, select } from '@ngrx/store';
import { take, switchMap, filter, distinctUntilChanged } from 'rxjs/operators';

import { Observable, of, forkJoin, combineLatest } from 'rxjs';

import { UserPuzzlesState } from '@redux/states/user-puzzles.state';

import { requestLoadUserPuzzles } from '@redux/actions/user-puzzles.actions';

import { getCountAllUserPuzzles } from '@redux/selectors/user-puzzles.selectors';
import { getProfile } from '@redux/selectors/auth.selectors';


@Injectable({
  providedIn: 'root'
})
export class UserPuzzlesGuard {

  constructor(
    private store: Store<UserPuzzlesState>
  ) { }

  canActivate(): Observable<boolean> {
    return forkJoin([
      this.checkUserPuzzlesState(),
    ]).pipe(
      switchMap(() => of(true))
    );
  }


  private checkUserPuzzlesState() {

    const countUserPuzzlesStates$ = this.store.pipe(
      select(getCountAllUserPuzzles),
    );

    const profile$ = this.store.pipe(
      select(getProfile)
    );


    combineLatest([countUserPuzzlesStates$, profile$]).pipe(
      filter(data => data[0] === 0 && !!data[1]),
      distinctUntilChanged()
    ).subscribe(data => {
      this.initRequestLoadUserPuzzles(data[1].uid);
    });

    return of(true);
  }


  private initRequestLoadUserPuzzles(uidUser: string) {
    const action = requestLoadUserPuzzles({ uidUser });
    this.store.dispatch(action);
  }

}
