import { Injectable } from '@angular/core';
import { Store, select } from '@ngrx/store';

// states
import { CoordinatesPuzzlesState } from '@redux/states/coordinates-puzzles.state';

import { requestAddOneCoordinatesPuzzleT } from '@redux/actions/coordinates-puzzles.actions';



import { CoordinatesPuzzle } from '@models/coordinates-puzzles.model';

import { FirestoreService } from '@services/firestore.service';
import { Observable, from } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CoordinatesPuzzlesService {

  constructor(
    private store: Store<CoordinatesPuzzlesState>,
    private firestoreService: FirestoreService
  ) { }

  triggerRequestAddOneCoordinatesPuzzle(coordinatesPuzzle: CoordinatesPuzzle) {
    const action = requestAddOneCoordinatesPuzzleT({ coordinatesPuzzle });
    this.store.dispatch(action);
  }

  getCoordinatesPuzzles(uidUser: string): Observable<CoordinatesPuzzle[]> {
    return from<Promise<CoordinatesPuzzle[]>>(this.firestoreService.getCoordinatesPuzzles(uidUser));
  }

  addCoordinatesPuzzle(coordinatesPuzzle: CoordinatesPuzzle): Observable<string> {
    return from<Promise<string>>(this.firestoreService.addCoordinatesPuzzle(coordinatesPuzzle));
  }
}
