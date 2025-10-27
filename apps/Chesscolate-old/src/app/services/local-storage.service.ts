import { Injectable } from '@angular/core';

import { Storage } from '@ionic/storage-angular';


@Injectable({
  providedIn: 'root'
})
export class LocalStorageService {

  constructor(private storage: Storage) {
    this.init();
  }

  async init() {
    await this.storage.create();
  }

  // ************-------- Squares --------************
  async saveSquaresScore(scores: number[]) {
    await this.storage.set('squaresScores', scores);
  }

  async getSquaresScores() {
    const scores = await this.storage.get('squaresScores');
    return scores || [];
  }
}
