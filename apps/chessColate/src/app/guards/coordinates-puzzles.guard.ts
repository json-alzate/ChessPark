import { Injectable } from '@angular/core';




import { Store, select } from '@ngrx/store';
import { take, switchMap, filter, distinctUntilChanged } from 'rxjs/operators';

import { Observable, of, forkJoin, combineLatest } from 'rxjs';

import { CoordinatesPuzzlesState } from '@redux/states/coordinates-puzzles.state';

import { requestGetCoordinatesPuzzles } from '@redux/actions/coordinates-puzzles.actions';

import { getCountAllCoordinatesPuzzles } from '@redux/selectors/coordinates-puzzles.selectors';
import { getProfile } from '@redux/selectors/auth.selectors';


@Injectable({
  providedIn: 'root'
})
export class CoordinatesPuzzlesGuard {

  constructor(
    private store: Store<CoordinatesPuzzlesState>
  ) { }

  canActivate(): Observable<boolean> {
    return forkJoin([
      this.checkCoordinatesPuzzlesState(),
    ]).pipe(
      switchMap(() => of(true))
    );
  }


  private checkCoordinatesPuzzlesState() {

    const countCoordinatesPuzzlesStates$ = this.store.pipe(
      select(getCountAllCoordinatesPuzzles),
    );

    const profile$ = this.store.pipe(
      select(getProfile)
    );


    combineLatest([countCoordinatesPuzzlesStates$, profile$]).pipe(
      filter(data => data[0] === 0 && !!data[1]?.uid),
      distinctUntilChanged()
    ).subscribe(data => {
      this.requestLoadCoordinatesPuzzles(data[1].uid);
    });

    return of(true);
  }


  private requestLoadCoordinatesPuzzles(uidUser: string) {
    const action = requestGetCoordinatesPuzzles({ uidUser });
    this.store.dispatch(action);
  }

}
