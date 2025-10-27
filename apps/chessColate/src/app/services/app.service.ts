import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { lastValueFrom, take } from 'rxjs';

import {
  Opening,
  PuzzleThemes,
  PuzzleThemesGroup
} from '@cpark/models';


@Injectable({
  providedIn: 'root'
})
export class AppService {

  themesPuzzle: PuzzleThemesGroup[] = [];
  themesPuzzlesList: PuzzleThemes[] = [];

  openingsList: Opening[] = [];

  // Idioma por defecto - TODO: usar TranslateService cuando se configure
  private currentLang = 'es';

  constructor(
    private httpClient: HttpClient
  ) { }

  get getThemesPuzzle() {
    return this.themesPuzzle;
  }

  get getThemesPuzzlesList() {
    return this.themesPuzzlesList;
  }

  get getOpeningsList() {
    return this.openingsList;
  }

  getThemePuzzleByValue(value: string) {
    const theme = this.themesPuzzlesList.find(themeItem => themeItem.value === value);
    if (!theme) {
      console.log('No se encontró el tema', value);
    }
    return theme;
  }

  getNameThemePuzzleByValue(value: string, lang?: string) {
    // TODO: usar TranslateService.currentLang cuando se configure
    if (!lang) {
      lang = this.currentLang;
    }
    if (lang === 'es') {
      return this.getThemePuzzleByValue(value)?.nameEs || '';
    } else {
      return this.getThemePuzzleByValue(value)?.nameEn || '';
    }
  }

  getDescriptionThemePuzzleByValue(value: string) {
    // TODO: usar TranslateService.currentLang cuando se configure
    const lang = this.currentLang;
    if (lang === 'es') {
      return this.getThemePuzzleByValue(value)?.descriptionEs || '';
    } else {
      return this.getThemePuzzleByValue(value)?.descriptionEn || '';
    }
  }

  async loadThemesPuzzle() {
    const request$ = this.httpClient.get<PuzzleThemesGroup[]>('assets/data/themes-puzzle.json')
      .pipe(take(1));
    this.themesPuzzle = await lastValueFrom<PuzzleThemesGroup[]>(request$);

    this.themesPuzzlesList = this.themesPuzzle.reduce<PuzzleThemes[]>((acc, themeGroup) =>
      [...acc, ...themeGroup.themes], []);

  }

  async loadOpenings() {
    const request$ = this.httpClient.get<Opening[]>('assets/data/openings.json')
      .pipe(take(1));
    this.openingsList = await lastValueFrom<Opening[]>(request$);
  }

  getOpeningByValue(value: string) {
    const opening = this.openingsList.find(openingItem => openingItem.value === value) || {} as Opening;
    return opening;
  }

  getNameOpeningByValue(value: string) {
    // TODO: usar TranslateService.currentLang cuando se configure
    const lang = this.currentLang;
    if (lang === 'es') {
      return this.getOpeningByValue(value).nameEs;
    } else {
      return this.getOpeningByValue(value).nameEn;
    }
  }

  getDescriptionOpeningByValue(value: string) {
    // TODO: usar TranslateService.currentLang cuando se configure
    const lang = this.currentLang;
    if (lang === 'es') {
      return this.getOpeningByValue(value).descriptionEs;
    } else {
      return this.getOpeningByValue(value).descriptionEn;
    }
  }

  validateThemesInList(theme: string): boolean {
    return !!this.themesPuzzlesList.find(themeItem => themeItem.value === theme);
  }

}
