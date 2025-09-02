import { Injectable } from '@angular/core';

import { Store, select } from '@ngrx/store';
import { take, switchMap, filter, distinctUntilChanged } from 'rxjs/operators';

import { Observable, of, forkJoin, combineLatest } from 'rxjs';

import { PlansElosState } from '@redux/states/plans-elos.state';

import { getCountAllPlansElos } from '@redux/selectors/plans-elos.selectors';
import { getProfile } from '@redux/selectors/auth.selectors';

import { PlansElosService } from '@services/plans-elos.service';


@Injectable({
  providedIn: 'root'
})
export class PlansElosGuard {

  constructor(
    private plansElosService: PlansElosService,
    private store: Store<PlansElosState>
  ) { }


  canActivate(): Observable<boolean> {
    // Permitir la activación sin bloquear
    this.checkPlansElosState();
    return of(true);
  }


  private checkPlansElosState() {

    const countPlansElosStates$ = this.store.pipe(
      select(getCountAllPlansElos)
    );

    const profile$ = this.store.pipe(
      select(getProfile)
    );

    combineLatest([countPlansElosStates$, profile$]).pipe(
      filter(data => data[0] === 0 && !!data[1]?.uid),
      distinctUntilChanged()
    ).subscribe(data => {
      this.plansElosService.requestGetPlansElosAction(data[1].uid);
    });

    return of(true);
  }


}
