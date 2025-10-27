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
import { PuzzlesCacheService } from '@services/puzzles-cache.service';

// utils

@Injectable({
  providedIn: 'root'
})
export class PuzzlesService {

  private puzzles: Puzzle[] = [];

  constructor(
    private http: HttpClient,
    private firestoreService: FirestoreService,
    private store: Store<PuzzlesState>,
    private puzzlesCacheService: PuzzlesCacheService,
  ) { }


  async getPuzzlesV1(options: PuzzleQueryOptions, actionMethod?: 'toStore' | 'return') {

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


  async getPuzzlesV2(options: PuzzleQueryOptions, actionMethod?: 'toStore' | 'return') {
    const { elo = 1500, theme, openingFamily, color } = options;

    // remplaza el elo, solo si el que llega es menor a 400
    if (elo < 400) {
      options.elo = 400;
    }
    console.log('getPuzzles', options);

    const repoBase = this.getRepoBase(theme, openingFamily);
    const adjustedColor = color === 'w' ? 'b' : color === 'b' ? 'w' : 'N/A';

    // const fileName = openingFamily
    //   ? `openings/${this.slugify(openingFamily)}_${this.eloRange(elo)}.json`
    //   : theme
    //     ? `${theme}/${theme}_${this.eloRange(elo)}.json`
    //     : null;

    const fileName = !theme ?
      `puzzlesFilesOpenings/${openingFamily}/${openingFamily}_${this.eloRange(options.elo)}.json`
      : `puzzlesFilesThemes/${theme}/${theme}_${this.eloRange(options.elo)}.json`;


    if (!fileName || !repoBase) {
      throw new Error('No se puede determinar el archivo de puzzles');
    }

    const url = `${repoBase}/${fileName}`;
    console.log('puzzles url', url);


    try {
      const puzzles = await firstValueFrom(this.http.get<Puzzle[]>(url));
      // TODO: Add to local storage file
      let filteredPuzzles = puzzles;
      //  puzzles.filter(p => !color || p.color === adjustedColor);
      console.log('color filtered', adjustedColor, filteredPuzzles.length);

      if (adjustedColor === 'w' || adjustedColor === 'b') {
        filteredPuzzles = puzzles.filter(puzzle => {
          const fenParts = puzzle.fen.split(' ');
          const puzzleColor = fenParts[1];
          return puzzleColor === adjustedColor;
        });
      }

      if (actionMethod === 'return') { return filteredPuzzles; }

      this.store.dispatch(addPuzzles({ puzzles: filteredPuzzles }));
      this.puzzles.push(...filteredPuzzles);
    } catch (error) {
      console.error('Error al cargar puzzles:', error);
      throw error;
    }
  }

  async getPuzzles(options: PuzzleQueryOptions, actionMethod?: 'toStore' | 'return') {
    // TODO: adicionar logica del back para cuando el elo y el tema tienen pocos puzzles (adicionar mas, jugando con el incremento del ELO,
    // o  decremento del ELO) para garantizar que haya suficientes puzzles para jugar
    const { elo = 1500, theme, openingFamily, color } = options;
    if (elo < 400) { options.elo = 400; }

    const repoBase = this.getRepoBase(theme, openingFamily);
    const adjustedColor = color === 'w' ? 'b' : color === 'b' ? 'w' : 'N/A';

    const fileName = !theme
      ? `puzzlesFilesOpenings/${openingFamily}/${openingFamily}_${this.eloRange(options.elo)}.json`
      : `puzzlesFilesThemes/${theme}/${theme}_${this.eloRange(options.elo)}.json`;

    if (!fileName || !repoBase) { throw new Error('No se puede determinar el archivo de puzzles'); }

    const url = `${repoBase}/${fileName}`;
    console.log('puzzles url', url);

    try {
      let puzzles: Puzzle[] = [];

      if (await this.puzzlesCacheService.isFileCached(url)) {
        const cached = await this.puzzlesCacheService.getCachedPuzzles(url);
        if (cached) {
          console.log('Usando puzzles cacheados');
          puzzles = cached;
        }
      }

      if (puzzles.length === 0) {
        console.log('Descargando desde CDN...');
        puzzles = await firstValueFrom(this.http.get<Puzzle[]>(url));
        // ⚠ No bloquear: se cachea después
        this.puzzlesCacheService.cachePuzzles(url, puzzles).catch(e => console.warn('Error cacheando', e));
      }

      let filteredPuzzles = puzzles;
      if (adjustedColor === 'w' || adjustedColor === 'b') {
        filteredPuzzles = puzzles.filter(p => p.fen.split(' ')[1] === adjustedColor);
      }

      filteredPuzzles = this.shuffleArrayPuzzles(filteredPuzzles);
      if (actionMethod === 'return') { return filteredPuzzles; }

      this.store.dispatch(addPuzzles({ puzzles: filteredPuzzles }));
      this.puzzles.push(...filteredPuzzles);

    } catch (error) {
      console.error('Error al cargar puzzles:', error);
      throw error;
    }
  }

  private shuffleArrayPuzzles(array: Puzzle[]): Puzzle[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1)); // selecciona un índice aleatorio desde 0 hasta i
      [array[i], array[j]] = [array[j], array[i]]; // intercambia elementos array[i] y array[j]
    }
    return array;
  }

  private getRepoBase(theme?: string, openingFamily?: string): string {
    const base = 'https://cdn.jsdelivr.net/gh';
    const user = 'json-alzate'; // Reemplaza por tu usuario o nombre de organización

    if (openingFamily && !theme) {
      return `${base}/${user}/chesscolate-puzzles-files-openings@main`;
    }

    if (!theme) { return null; }

    const firstLetter = theme.charAt(0).toLowerCase();
    if (firstLetter >= 'a' && firstLetter <= 'h') {
      return `${base}/${user}/chesscolate-puzzles-files-themes-a-h@main`;
    } else if (firstLetter >= 'i' && firstLetter <= 'o') {
      return `${base}/${user}/chesscolate-puzzles-files-themes-i-o@main`;
    } else {
      return `${base}/${user}/chesscolate-puzzles-files-themes-p-z@main`;
    }
  }

  private eloRange(elo: number): string {
    const start = Math.floor(elo / 20) * 20;
    const end = start + 19;
    return `${start}_${end}`;
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '_');
  }


}
