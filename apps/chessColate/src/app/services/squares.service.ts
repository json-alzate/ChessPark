import { Injectable } from '@angular/core';

import { LocalStorageService } from '@services/local-storage.service';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SquaresService {

  scores$ = new Subject<number[]>();

  constructor(
    private localStorageService: LocalStorageService
  ) { }

  emitScores(scores: number[]) {
    this.scores$.next(scores);
  }

  getScores() {
    this.localStorageService.getSquaresScores().then((scores: number[]) => {
      this.emitScores(scores);
    });
  }

  saveScore(score: number) {
    this.localStorageService.getSquaresScores().then((scores: number[]) => {
      scores.push(score);
      this.localStorageService.saveSquaresScore(scores);
      this.emitScores(scores);
    });
  }

}
