import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { HttpClient } from '@angular/common/http';

import { firstValueFrom } from 'rxjs';


import { Store, select } from '@ngrx/store';

// states
import { PuzzlesState } from '@redux/states/puzzles.state';


// actions
import { requestLoadPuzzles, addPuzzles } from '@redux/actions/puzzles.actions';
import { requestAddOneUserPuzzle } from '@redux/actions/user-puzzles.actions';

// selectors
import { getPuzzlesToResolve } from '@redux/selectors/puzzles.selectors';
import { getProfile } from '@redux/selectors/auth.selectors';


// models
import { Puzzle, PuzzleQueryOptions } from '@models/puzzle.model';

// services
import { FirestoreService } from '@services/firestore.service';
import { UserPuzzlesService } from '@services/user-puzzles.service';
import { AppService } from '@services/app.service';

// utils

@Injectable({
  providedIn: 'root'
})
export class PuzzlesService {

  private puzzles: Puzzle[] = [];

  constructor(
    private http: HttpClient,
    private firestoreService: FirestoreService,
    private store: Store<PuzzlesState>
  ) { }


  async getPuzzles(options: PuzzleQueryOptions, actionMethod?: 'toStore' | 'return') {

    let path = `get-puzzles?elo=${options.elo}`;

    if (options.theme) {
      path = path + `&theme=${options.theme}`;
    }
    if (options.openingFamily) {
      path = path + `&openingFamily=${options.openingFamily}`;
    }
    if (options.color) {
      // El color se invierte porque se busca por la posicion inicial del fen,
      // (luego se hace la jugada, y el puzzle queda listo para resolverse)
      const colorInverted = options.color === 'w' ? 'b' : 'w';
      path = path + `&color=${colorInverted}`;
    }

    console.log(path);


    const newPuzzlesFromDB = await firstValueFrom(this.http.get<Puzzle[]>(environment.apiPuzzlesUrl + path));
    if (!actionMethod || actionMethod === 'toStore') {
      // adicionar puzzles al estado de redux
      this.store.dispatch(addPuzzles({ puzzles: newPuzzlesFromDB }));
      // se adiciona al array local de puzzles
      this.puzzles.push(...newPuzzlesFromDB);
    } else if (actionMethod === 'return') {
      return newPuzzlesFromDB;
    }
  }


}
