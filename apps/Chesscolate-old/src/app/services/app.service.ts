import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { TranslateService } from '@ngx-translate/core';

import { lastValueFrom, take } from 'rxjs';

import {
  Opening,
  AppPuzzlesThemes,
  AppPuzzleThemesGroup
} from '@models/app.models';


@Injectable({
  providedIn: 'root'
})
export class AppService {

  themesPuzzle: AppPuzzleThemesGroup[] = [];
  themesPuzzlesList: AppPuzzlesThemes[] = [];

  openingsList: Opening[] = [];


  constructor(
    private httpClient: HttpClient,
    private translateService: TranslateService
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
    if (!lang) {
      lang = this.translateService.currentLang;
    }
    if (lang === 'es') {
      return this.getThemePuzzleByValue(value)?.nameEs || '';
    } else {
      return this.getThemePuzzleByValue(value)?.nameEn || '';
    }
  }

  getDescriptionThemePuzzleByValue(value: string) {
    const lang = this.translateService.currentLang;
    if (lang === 'es') {
      return this.getThemePuzzleByValue(value)?.descriptionEs || '';
    } else {
      return this.getThemePuzzleByValue(value)?.descriptionEn || '';
    }
  }

  async loadThemesPuzzle() {
    const request$ = this.httpClient.get<AppPuzzleThemesGroup[]>('assets/data/themes-puzzle.json')
      .pipe(take(1));
    this.themesPuzzle = await lastValueFrom<AppPuzzleThemesGroup[]>(request$);

    this.themesPuzzlesList = this.themesPuzzle.reduce((acc, themeGroup) =>
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
    const lang = this.translateService.currentLang;
    if (lang === 'es') {
      return this.getOpeningByValue(value).nameEs;
    } else {
      return this.getOpeningByValue(value).nameEn;
    }
  }

  getDescriptionOpeningByValue(value: string) {
    const lang = this.translateService.currentLang;
    if (lang === 'es') {
      return this.getOpeningByValue(value).descriptionEs;
    } else {
      return this.getOpeningByValue(value).descriptionEn;
    }
  }

  validateThemesInList(theme: string): boolean {
    return !!this.themesPuzzlesList.find(themeItem => themeItem.value === theme);
  }


  logWaring(message: string, ...optionalParams: any[]) {
    console.warn(message, optionalParams);
  }

  logError(message: string, ...optionalParams: any[]) {
    console.error(message, optionalParams);
  }
}
