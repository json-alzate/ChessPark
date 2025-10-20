/* eslint-disable @typescript-eslint/dot-notation */
import { Injectable } from '@angular/core';

import { TranslateService } from '@ngx-translate/core';

import { Puzzle, PuzzleQueryOptions } from '@models/puzzle.model';
import { Block, PlanTypes } from '@models/plan.model';
import { Profile } from '@models/profile.model';

import { PlansElosService } from '@services/plans-elos.service';
import { PuzzlesService } from '@services/puzzles.service';
import { ProfileService } from '@services/profile.service';
import { AppService } from '@services/app.service';

@Injectable({
  providedIn: 'root'
})
export class BlockService {


  constructor(
    private puzzlesService: PuzzlesService,
    private profileService: ProfileService,
    private appService: AppService,
    private translateService: TranslateService,
    private plansElosService: PlansElosService
  ) { }

  async getPuzzlesForBlock(blockSettings: Block): Promise<Puzzle[]> {

    const options: PuzzleQueryOptions = {
      elo: blockSettings.elo,
      theme: blockSettings.theme,
      openingFamily: blockSettings.openingFamily
    };

    if (blockSettings.color !== 'random') {
      options.color = blockSettings.color === 'white' ? 'w' : 'b';
    }

    const puzzlesToAdd: Puzzle[] = await this.puzzlesService.getPuzzles(options, 'return');

    let puzzles: Puzzle[] = [];

    if (blockSettings.puzzles) {
      puzzles = [...blockSettings.puzzles, ...puzzlesToAdd];
    } else {
      puzzles = puzzlesToAdd;
    }

    return puzzles;

  }

  async generateBlocksForPlan(option: PlanTypes): Promise<Block[]> {

    return new Promise((resolve, reject) => {

      const profile: Profile = this.profileService.getProfile;
      const defaultEloStart = 800;
      const defaultElo = 1500;

      const whiteColorText = this.translateService.instant('PUZZLES.white');
      const blackColorText = this.translateService.instant('PUZZLES.black');

      // Nota: si el tiempo del puzzle es mayor que el tiempo del bloque, el tiempo restante
      // para el puzzle se convierte en el tiempo restante del bloque
      switch (option) {
        case 'warmup': // Calentamiento / un mismo color
          //  2 minutos de mates en 1 (elo - 500) / tiempo por puzzle = 10 segundos
          //  1 minuto de mates en 2 / tiempo por puzzle = 10 segundos
          // 1 ejercicio de mate
          const color0 = Math.random() > 0.5 ? 'white' : 'black';
          const mateIn1Elo0 = profile?.elos?.warmup ? profile?.elos?.warmup['mateIn1'] : undefined;
          const mateIn2Elo0 = profile?.elos?.warmup ? profile?.elos?.warmup['mateIn2'] : undefined;
          const mateElo0 = profile?.elos?.warmup ? profile?.elos?.warmup['mate'] : undefined;

          const blocks0: Block[] = [
            {
              time: 60,
              puzzlesCount: 0,
              theme: 'mateIn1',
              elo: mateIn1Elo0 || defaultElo,
              color: color0,
              puzzleTimes: {
                warningOn: 12,
                dangerOn: 6,
                total: 20
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true
            },
            {
              time: 60,
              puzzlesCount: 0,
              theme: 'mateIn2',
              elo: mateIn2Elo0 || defaultElo,
              color: color0,
              puzzleTimes: {
                warningOn: 12,
                dangerOn: 6,
                total: 20
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true
            },
            {
              time: -1,
              puzzlesCount: 1,
              theme: 'mate',
              elo: mateElo0 || defaultElo,
              puzzlesPlayed: [],
              color: color0,
              showPuzzleSolution: true
            }
          ];
          resolve(blocks0);
          break;
        case 'plan5':
          /* No Muestra soluciones / un mismo color
              - tema random = t 2.5 minutos / 15 segundos por puzzle
              - tema debilidades (elo - 200) = t 2.5 minutos / 30 segundos por puzzle
          */
          const color5 = Math.random() > 0.5 ? 'white' : 'black';
          // obtener el tema random , asignando una posición aleatoria de un array
          const themeRandom5 = this.appService.getThemesPuzzlesList[
            Math.floor(Math.random() * this.appService.getThemesPuzzlesList.length)
          ].value;
          if (!themeRandom5) {
            reject('No se pudo obtener el tema random themeRandom5');
          }
          // se busca el elo del usuario según el string del temaRandom5
          const themeRandomElo5 = profile?.elos?.plan5 ? profile?.elos?.plan5[themeRandom5] : undefined;
          // se elige el elo mas bajo que el usuario tenga en el plan5, sino se asigna el elo por defecto
          let themeWeakness5;

          if (profile?.elos?.plan5) {
            themeWeakness5 = this.plansElosService.getWeakness(profile?.elos?.plan5);
          }

          if (!themeWeakness5) {
            themeWeakness5 = this.getRandomTheme();
          }

          const eloThemeWeakness5 = profile?.elos?.plan5 ? profile?.elos?.plan5[themeWeakness5] : undefined;


          const block5: Block[] = [
            {
              time: 150,
              puzzlesCount: 0,
              theme: themeRandom5,
              // eslint-disable-next-line max-len
              description: this.translateService.instant('PUZZLES.randomThemeWith') + (color5 === 'white' ? whiteColorText : blackColorText),
              elo: themeRandomElo5 || defaultElo,
              color: color5,
              puzzleTimes: {
                warningOn: 12,
                dangerOn: 6,
                total: 15
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true
            },
            {
              time: 150,
              puzzlesCount: 0,
              theme: themeWeakness5,
              description: this.translateService.instant('PUZZLES.weaknessWith') + (color5 === 'white' ? whiteColorText : blackColorText),
              elo: eloThemeWeakness5 || defaultElo,
              color: color5,
              puzzleTimes: {
                warningOn: 24,
                dangerOn: 12,
                total: 30
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true
            }
          ];
          resolve(block5);
          break;
        case 'plan10':

          /**  Muestra soluciones / un mismo color
           * - tema random || debilidades = t 2 minutos / 15 segundos por puzzle (elo - 100)
           * - apertura random || apertura débil = t 2 minutos / 30 segundos por puzzle
           * - misma apertura + mismo tema  = t 3 minutos / 60 segundos por puzzle
           * - mismo tema = t 1 minuto / 20 segundos por puzzle
           * - misma apertura + finales = t 2 minutos / 60 segundos por puzzle
           */
          const color10 = Math.random() > 0.5 ? 'white' : 'black';

          let theme10: string;
          let opening10: string;
          if (Math.random() < 0.5) { // tema random o debilidad
            // tema random
            theme10 = this.getRandomTheme();
            if (!theme10) {
              reject('No se pudo obtener el tema random theme10');
            }

          } else {
            // tema debilidad
            theme10 = profile?.elos?.plan10 ? this.getWeaknessInPlan(profile?.elos?.plan10) : this.getRandomTheme();

          }
          // se busca el elo del usuario según el string del theme10
          const eloTheme10 = profile?.elos?.plan10 ? profile.elos.plan10[theme10] : undefined;
          if (Math.random() < 0.5) { // apertura random o debilidad
            // apertura random
            opening10 = this.getRandomOpening();
            if (!opening10) {
              reject('No se pudo obtener la apertura random opening10');
            }

          } else {
            // se elige la apertura con el elo mas bajo que el usuario tenga en el plan10,
            opening10 = profile?.elos?.plan10Openings ? this.getWeaknessInPlanOpenings(profile?.elos?.plan10Openings)
              : this.getRandomOpening();
          }
          // se busca el elo del usuario según el string de la opening10
          const eloOpening10 = profile?.elos?.plan10Openings ? profile?.elos?.plan10Openings[opening10] : undefined;

          const block10: Block[] = [
            {
              time: 120,
              puzzlesCount: 0,
              theme: theme10,
              elo: eloTheme10 || defaultElo,
              color: color10,
              puzzleTimes: {
                warningOn: 12,
                dangerOn: 6,
                total: 20
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true
            },
            {
              time: 120,
              puzzlesCount: 0,
              theme: '',
              openingFamily: opening10,
              elo: eloOpening10 || defaultElo,
              color: color10,
              puzzleTimes: {
                warningOn: 15,
                dangerOn: 8,
                total: 30
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true
            },
            {
              time: 180,
              puzzlesCount: 0,
              description: this.translateService.instant('PUZZLES.sameOpeningAndTheme'),
              theme: theme10,
              openingFamily: opening10,
              elo: eloTheme10 || defaultElo,
              color: color10,
              puzzleTimes: {
                warningOn: 30,
                dangerOn: 15,
                total: 60
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true
            },
            {
              time: 60,
              puzzlesCount: 0,
              theme: theme10,
              description: this.translateService.instant('PUZZLES.sameThemeLessTime'),
              elo: eloTheme10 || defaultElo,
              color: color10,
              puzzleTimes: {
                warningOn: 12,
                dangerOn: 6,
                total: 15
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true
            },
            {
              time: 120,
              puzzlesCount: 0,
              theme: 'endgame',
              openingFamily: opening10,
              elo: eloOpening10 || defaultElo,
              color: color10,
              puzzleTimes: {
                warningOn: 30,
                dangerOn: 15,
                total: 60
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true
            }
          ];

          resolve(block10);
          break;
        case 'plan20':
          /** Muestra soluciones / cambio de color
           * -  debilidades = t 3 minutos / 40 segundos por puzzle (elo - 500)
           * -  tema random = t 5 minutos / 3 minutos por puzzle
           * -  mate en 1 = t 2 minutos / 10 segundos por puzzle
           * -  mismo tema random = t 2 minutos / 50 segundos por puzzle (elo - 300)
           * -  mismo tema random = t 2 minuto / 50 segundos por puzzle (elo + 200)
           * - mismo tema random = t 1 minuto / 15 segundos por puzzle (elo - 800)
           *    ||  mismo tema random a ciegas 10 segundos = t 1 minuto / 60 segundos por puzzle
           * - finales = t 3 minutos / 60 segundos por puzzle
           * - mate 3 = t 2 minutos / 60 segundos por puzzle
           * */

          const theme20Random = this.getRandomTheme();
          const themeWeakness20 = profile?.elos?.plan20 ? this.getWeaknessInPlan(profile?.elos?.plan20) : this.getRandomTheme();
          const eloThemeWeakness20 = profile?.elos?.plan20 ? profile?.elos?.plan20[themeWeakness20] : undefined;
          const eloTheme20Random = profile?.elos?.plan20 ? profile?.elos?.plan20[theme20Random] : undefined;
          const eloMateIn120 = profile?.elos?.plan20 ? profile?.elos?.plan20['mateIn1'] : undefined;
          const eloEndgame20 = profile?.elos?.plan20 ? profile?.elos?.plan20['endgame'] : undefined;
          const eloMateIn320 = profile?.elos?.plan20 ? profile?.elos?.plan20['mateIn3'] : undefined;

          let randomBlockOrBlind: Block;

          if (Math.random() < 0.5 ? true : false) {
            // tema a ciegas
            randomBlockOrBlind = {
              time: 120,
              puzzlesCount: 0,
              theme: theme20Random,
              description: this.translateService.instant('PUZZLES.sameRandomTheme'),
              elo: eloTheme20Random || defaultElo,
              color: 'random',
              puzzleTimes: {
                warningOn: 8,
                dangerOn: 5,
                total: 15
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true
            };

          } else {
            randomBlockOrBlind = {
              time: 120,
              puzzlesCount: 0,
              theme: theme20Random,
              description: this.translateService.instant('sameOpeningRandomThemeBlind'),
              elo: eloTheme20Random || defaultElo,
              color: 'random',
              puzzleTimes: {
                warningOn: 24,
                dangerOn: 12,
                total: 60
              },
              goshPuzzle: true,
              goshPuzzleTime: 10,
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true
            };
          }


          const block20: Block[] = [
            {
              time: 240,
              puzzlesCount: 0,
              theme: themeWeakness20,
              description: this.translateService.instant('PUZZLES.weaknessWithAnyColor'),
              elo: eloThemeWeakness20 || defaultElo,
              color: 'random',
              puzzleTimes: {
                warningOn: 24,
                dangerOn: 12,
                total: 40
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true
            },
            {
              time: 300,
              puzzlesCount: 0,
              theme: theme20Random,
              description: this.translateService.instant('PUZZLES.randomThemeWithAnyColor'),
              elo: eloTheme20Random || defaultElo,
              color: 'random',
              puzzleTimes: {
                warningOn: 50,
                dangerOn: 20,
                total: 240
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true
            },
            {
              time: 120,
              puzzlesCount: 0,
              theme: 'mateIn1',
              elo: eloMateIn120 || defaultElo,
              color: 'random',
              puzzleTimes: {
                warningOn: 6,
                dangerOn: 3,
                total: 10
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true
            },
            {
              time: 120,
              puzzlesCount: 0,
              theme: theme20Random,
              description: this.translateService.instant('PUZZLES.sameThemeLessTime'),
              elo: eloTheme20Random || defaultElo,
              color: 'random',
              puzzleTimes: {
                warningOn: 24,
                dangerOn: 12,
                total: 50
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true
            },
            randomBlockOrBlind,
            {
              time: 180,
              puzzlesCount: 0,
              theme: 'endgame',
              elo: eloEndgame20 || defaultElo,
              color: 'random',
              puzzleTimes: {
                warningOn: 24,
                dangerOn: 12,
                total: 60
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true
            },
            {
              time: 120,
              puzzlesCount: 0,
              theme: 'mateIn3',
              elo: eloMateIn320 || defaultElo,
              color: 'random',
              puzzleTimes: {
                warningOn: 24,
                dangerOn: 12,
                total: 60
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true
            },
          ];

          resolve(block20);


          break;
        case 'plan30':
          /** Muestra soluciones / un mismo color
           * -  debilidades = t 5 minutos / 60 segundos por puzzle (elo - 200)
           * -   apertura random = t 2 minutos / 30 segundos por puzzle
           * -  tema random = t 5 minutos / 3 minutos por puzzle
           * -  mismo tema random  a ciegas 15 segundos = t 5 minutos / 50 segundos por puzzle (elo - 300)
           * -  finales = t 5 minutos / 60 segundos por puzzle
           * - finales de peones = t 5 minutos / 3 minutos por puzzle
           * - mate 4 o mas = t 2 minutos / 60 segundos por puzzle
           * */

          const color30 = Math.random() > 0.5 ? 'white' : 'black';
          const themeWeakness30 = profile?.elos?.plan30 ? this.getWeaknessInPlan(profile?.elos?.plan30) : this.getRandomTheme();


          const eloThemeWeakness30 = profile?.elos?.plan30 ? profile?.elos?.plan30[themeWeakness30] : undefined;
          const theme30Random = this.getRandomTheme();
          const eloTheme30Random = profile?.elos?.plan30 ? profile?.elos?.plan30[theme30Random] : undefined;
          const opening30Random = this.getRandomOpening();
          const eloOpening30Random = profile?.elos?.plan30Openings ? profile?.elos?.plan30Openings[opening30Random] : undefined;
          const eloEndgame30 = profile?.elos?.plan30 ? profile?.elos?.plan30['endgame'] : undefined;
          const eloPawnEndgame30 = profile?.elos?.plan30 ? profile?.elos?.plan30['pawnEndgame'] : undefined;
          const eloMateIn430 = profile?.elos?.plan30 ? profile?.elos?.plan30['mateIn4'] : undefined;

          const block30: Block[] = [
            {
              time: 300,
              puzzlesCount: 0,
              theme: themeWeakness30,
              // eslint-disable-next-line max-len
              description: this.translateService.instant('PUZZLES.weaknessWith') + (color30 === 'white' ? whiteColorText : blackColorText),
              elo: eloThemeWeakness30 || defaultElo,
              color: color30,
              puzzleTimes: {
                warningOn: 40,
                dangerOn: 20,
                total: 60
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true
            },
            {
              time: 120,
              puzzlesCount: 0,
              theme: '',
              description: this.translateService.instant('PUZZLES.randomOpening'),
              openingFamily: opening30Random,
              elo: eloOpening30Random || defaultElo,
              color: color30,
              puzzleTimes: {
                warningOn: 15,
                dangerOn: 8,
                total: 30
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true
            },
            {
              time: 300,
              puzzlesCount: 0,
              theme: theme30Random,
              description: this.translateService.instant('PUZZLES.randomTheme'),
              elo: eloTheme30Random || defaultElo,
              color: color30,
              puzzleTimes: {
                warningOn: 50,
                dangerOn: 20,
                total: 180
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true
            },
            {
              time: 300,
              puzzlesCount: 0,
              theme: theme30Random,
              description: this.translateService.instant('PUZZLES.sameOpeningRandomThemeBlind'),
              elo: eloTheme30Random || defaultElo,
              color: color30,
              puzzleTimes: {
                warningOn: 20,
                dangerOn: 10,
                total: 50
              },
              goshPuzzle: true,
              goshPuzzleTime: 15,
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true
            },
            {
              time: 300,
              puzzlesCount: 0,
              theme: 'endgame',
              elo: eloEndgame30 || defaultElo,
              color: color30,
              puzzleTimes: {
                warningOn: 20,
                dangerOn: 10,
                total: 60
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true
            },
            {
              time: 300,
              puzzlesCount: 0,
              theme: 'pawnEndgame',
              elo: eloPawnEndgame30 || defaultElo,
              color: color30,
              puzzleTimes: {
                warningOn: 20,
                dangerOn: 10,
                total: 60
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true
            },
            {
              time: 180,
              puzzlesCount: 0,
              theme: 'mateIn4',
              elo: eloMateIn430 || defaultElo,
              color: color30,
              puzzleTimes: {
                warningOn: 20,
                dangerOn: 10,
                total: 60
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true
            },

          ];

          resolve(block30);


          break;
        case 'backToCalm':
          /**
           * Muestra soluciones / un mismo color
           * Vuelta a la calma
           * - 3 ejercicios de mates (elo : de 800 a 1000)
           * - 3 ejercicios de mates en 2 (elo : de 800 a 1000)
           * - 3 ejercicios de mates en 1 (elo : de 800 a 1000)
           */

          const colorBackToCalm = Math.random() > 0.5 ? 'white' : 'black';

          // un numero random entre 800 y 1500
          const eloBackToCalm = Math.floor(Math.random() * (defaultElo - defaultEloStart + 1)) + defaultEloStart;

          const blockBackToCalm: Block[] = [
            {
              time: -1,
              puzzlesCount: 3,
              theme: 'mate',
              elo: eloBackToCalm,
              color: colorBackToCalm,
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true
            },
            {
              time: -1,
              puzzlesCount: 3,
              theme: 'mateIn2',
              elo: eloBackToCalm,
              color: colorBackToCalm,
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true
            },
            {
              time: -1,
              puzzlesCount: 3,
              theme: 'mateIn1',
              elo: eloBackToCalm,
              color: colorBackToCalm,
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true
            }
          ];

          resolve(blockBackToCalm);

          break;
      }

    });
  }

  /**
   * Obtiene un tema random de la lista de temas
   * */
  getRandomTheme(): string {
    return this.appService.getThemesPuzzlesList[
      Math.floor(Math.random() * this.appService.getThemesPuzzlesList.length)
    ].value;
  }

  /**
   * Obtiene una apertura random de la lista de aperturas
   * */
  getRandomOpening(): string {
    return this.appService.getOpeningsList[
      Math.floor(Math.random() * this.appService.getOpeningsList.length)
    ].value;
  }

  /**
   * Obtiene el tema debil del usuario
   * según el plan que se le pase
   *
   * */
  // TODO: esto se elimina y se combina con el metodo del servicio de pla-elos,
  // importante transladar el mapeo
  getWeaknessInPlan(plan: {
    [key: string]: number;
  }): string {
    // se filtra solo para devolver los temas que existan en la lista de la app
    // es posible que los temas mapeados al plan desde el back no estén en la lista de temas
    const themesList = this.appService.getThemesPuzzlesList;
    let planElosFiltered: { [key: string]: number } = {};

    Object.keys(plan).forEach(key => {
      if (themesList.find(item => item.value === key)) {
        planElosFiltered = { ...planElosFiltered, [key]: plan[key] };
      }
    });
    // se elige el tema con el elo mas bajo que el usuario tenga en el plan,
    // sino elige un tema random de la lista de temas
    let theme = this.plansElosService.getWeakness(planElosFiltered);
    if (!theme) {
      theme = this.appService.getThemesPuzzlesList[
        Math.floor(Math.random() * this.appService.getThemesPuzzlesList.length)
      ].value;
    }
    return theme;
  }

  /**
   * Obtiene la apertura débil del usuario
   * según el plan que se le pase
   * */
  getWeaknessInPlanOpenings(plan: {
    [key: string]: number;
  }): string {

    // se filtra solo para devolver las aperturas que existan en la lista de la app
    const openingsList = this.appService.getOpeningsList;
    let planOpeningsFiltered: { [key: string]: number } = {};
    Object.keys(plan).forEach(key => {
      if (openingsList.find(item => item.value === key)) {
        planOpeningsFiltered = { ...planOpeningsFiltered, [key]: plan[key] };
      }
    });
    // se elige la apertura con el elo mas bajo que el usuario tenga en el plan,
    // sino elige una apertura random de la lista de aperturas
    let opening = this.plansElosService.getWeakness(planOpeningsFiltered);
    if (!opening) {
      opening = this.appService.getOpeningsList[
        Math.floor(Math.random() * this.appService.getOpeningsList.length)
      ].value;
    }

    return opening;
  }





}
