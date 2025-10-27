import { Injectable } from '@angular/core';




import { Store, select } from '@ngrx/store';
import { take, switchMap } from 'rxjs/operators';

import { Observable, of, forkJoin, combineLatest } from 'rxjs';

import { PuzzlesState } from '@redux/states/puzzles.state';

import { requestLoadPuzzles } from '@redux/actions/puzzles.actions';

import { getCountAllPuzzles } from '@redux/selectors/puzzles.selectors';
import { getProfile } from '@redux/selectors/auth.selectors';


@Injectable({
  providedIn: 'root'
})
export class PuzzlesGuard  {

  constructor(
    private store: Store<PuzzlesState>
  ) { }

  canActivate(): Observable<boolean> {
    return forkJoin([
      this.checkPuzzlesState(),
    ]).pipe(
      switchMap(() => of(true))
    );
  }


  private checkPuzzlesState() {

    const countPuzzlesStates$ = this.store.pipe(
      select(getCountAllPuzzles),
      take(1)
    );

    const profile$ = this.store.pipe(
      select(getProfile)
    );

    combineLatest([countPuzzlesStates$, profile$]).subscribe(data => {

      if (data[0] === 0 && data[1]) {
        this.requestLoadPuzzles(data[1].elo);
      }

    });

    return of(true);
  }


  private requestLoadPuzzles(elo: number) {
    const action = requestLoadPuzzles({ eloStar: elo - 600, eloEnd: elo + 600 });
    this.store.dispatch(action);
  }

}
