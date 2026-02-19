import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { combineLatest } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { of } from 'rxjs';

import { AppState } from '@cpark/state';
import { getCountAllCustomPlans } from '@cpark/state';
import { getProfile } from '@cpark/state';
import { loadCustomPlans } from '@cpark/state';
import { PlansElosFacadeService } from '@cpark/state';

@Injectable({ providedIn: 'root' })
export class CustomPlansGuard {
  private store = inject(Store<AppState>);
  private plansElosFacade = inject(PlansElosFacadeService);

  canActivate() {
    this.store.select(getProfile).pipe(take(1)).subscribe((profile) => {
      if (profile?.uid) {
        this.plansElosFacade.requestLoadPlansElos(profile.uid);
      }
    });

    combineLatest([
      this.store.select(getCountAllCustomPlans),
      this.store.select(getProfile),
    ])
      .pipe(
        filter(([count, profile]) => count === 0 && !!profile?.uid),
        take(1)
      )
      .subscribe(([, profile]) => {
        if (profile?.uid) {
          this.store.dispatch(loadCustomPlans({ uidUser: profile.uid }));
        }
      });

    return of(true);
  }
}
