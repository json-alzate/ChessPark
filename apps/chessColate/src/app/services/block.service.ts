/* eslint-disable @typescript-eslint/dot-notation */
import { Injectable, inject } from '@angular/core';

import { TranslocoService } from '@jsverse/transloco';

import { Puzzle } from '@cpark/models';
import { Block } from '@cpark/models';
import { Profile } from '@cpark/models';
import { PlanTypes } from '@cpark/models';
import { PuzzleQueryOptions } from '@cpark/models';

// import { PlansElosService } from '@services/plans-elos.service';
import { ProfileService } from '@services/profile.service';
import { AppService } from '@services/app.service';
import { PuzzlesProvider } from '@chesspark/puzzles-provider';
import { PlansElosService } from '@services/plans-elos.service';
import { PLAN_ALLOWED_THEMES } from '../plan-allowed-themes.config';

@Injectable({
  providedIn: 'root',
})
export class BlockService {
  private translocoService = inject(TranslocoService);
  private plansElosService = inject(PlansElosService);
  constructor(
    private profileService: ProfileService,
    private appService: AppService,
    private puzzlesProvider: PuzzlesProvider
  ) // private plansElosService: PlansElosService
  {}

  async getPuzzlesForBlock(blockSettings: Block): Promise<Puzzle[]> {
    const themeMapped =
      blockSettings.theme &&
      this.appService.getThemesPuzzlesList.some(
        (t) => t.value === blockSettings.theme
      );

    const options: PuzzleQueryOptions = {
      elo: blockSettings.elo,
      theme: themeMapped ? blockSettings.theme : undefined,
      openingFamily: blockSettings.openingFamily,
    };

    if (blockSettings.color !== 'random') {
      // El FEN del puzzle inicia con el turno del oponente; invertimos para pedir puzzles donde el usuario juegue el color indicado
      options.color = blockSettings.color === 'white' ? 'b' : 'w';
    }

    const puzzlesToAdd: Puzzle[] = await this.puzzlesProvider.getPuzzles(
      options
    );

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
      const profile: Profile | null = this.profileService.getProfile;
      const defaultEloStart = 800;
      const defaultElo = 1500;

      const whiteColorText = this.translocoService.translate(
        'PUZZLES.colors.white'
      );
      const blackColorText = this.translocoService.translate(
        'PUZZLES.colors.black'
      );

      // Nota: si el tiempo del puzzle es mayor que el tiempo del bloque, el tiempo restante
      // para el puzzle se convierte en el tiempo restante del bloque
      switch (option) {
        case 'warmup': // Calentamiento / un mismo color
          //  2 minutos de mates en 1 (elo - 500) / tiempo por puzzle = 10 segundos
          //  1 minuto de mates en 2 / tiempo por puzzle = 10 segundos
          // 1 ejercicio de mate
          const color0 = Math.random() > 0.5 ? 'white' : 'black';
          const mateIn1Elo0 = profile?.elos?.warmup
            ? profile?.elos?.warmup['mateIn1']
            : undefined;
          const mateIn2Elo0 = profile?.elos?.warmup
            ? profile?.elos?.warmup['mateIn2']
            : undefined;
          const mateElo0 = profile?.elos?.warmup
            ? profile?.elos?.warmup['mate']
            : undefined;

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
                total: 20,
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true,
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
                total: 20,
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true,
            },
            {
              time: -1,
              puzzlesCount: 1,
              theme: 'mate',
              elo: mateElo0 || defaultElo,
              puzzlesPlayed: [],
              color: color0,
              showPuzzleSolution: true,
            },
          ];
          resolve(blocks0);
          break;
        case 'plan1': // No muestra soluciones / un mismo color / 1 minuto de short
          const color1 = Math.random() > 0.5 ? 'white' : 'black';
          const shortElo1 = profile?.elos?.plan1
            ? profile?.elos?.plan1['short']
            : undefined;

          const block1: Block[] = [
            {
              time: 60,
              puzzlesCount: 0,
              theme: 'short',
              description: color1 === 'white' ? whiteColorText : blackColorText,
              elo: shortElo1 || defaultElo,
              color: color1,
              puzzleTimes: {
                warningOn: 6,
                dangerOn: 3,
                total: 10,
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
            },
          ];
          resolve(block1);
          break;
        case 'plan3': // No muestra soluciones / un mismo color / 3 minutos del tema mas fuerte del plan3
          const allowedThemes3 = PLAN_ALLOWED_THEMES['plan3'];
          const color3 = Math.random() > 0.5 ? 'white' : 'black';
          // se elige el elo mas fuerte que el usuario tenga en el plan3, filtrando temas mapeados
          const themeStrong3 = profile?.elos?.plan3
            ? this.getStrongestThemeInPlan(profile.elos.plan3, allowedThemes3)
            : this.getRandomTheme(allowedThemes3);

          const eloThemeStrong3 = profile?.elos?.plan3
            ? profile?.elos?.plan3[themeStrong3]
            : undefined;

          const block3: Block[] = [
            {
              time: 180,
              puzzlesCount: 0,
              theme: themeStrong3,
              description: color3 === 'white' ? whiteColorText : blackColorText,
              elo: eloThemeStrong3 || defaultElo,
              color: color3,
              puzzleTimes: {
                warningOn: 12,
                dangerOn: 6,
                total: 20,
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
            },
          ];
          resolve(block3);
          break;
        case 'plan5':
          /* No Muestra soluciones / un mismo color
              - tema random = t 2.5 minutos / 15 segundos por puzzle
              - tema debilidades (elo - 200) = t 2.5 minutos / 30 segundos por puzzle
              Limitado a los temas permitidos para el plan5 en el archivo plan-allowed-themes.config.ts
          */
          const allowedThemes5 = PLAN_ALLOWED_THEMES['plan5'];
          const color5 = Math.random() > 0.5 ? 'white' : 'black';
          // obtener el tema random , asignando una posición aleatoria de un array
          const themeRandom5 = this.getRandomTheme(allowedThemes5);
          if (!themeRandom5) {
            reject('No se pudo obtener el tema random themeRandom5');
          }
          // se busca el elo del usuario según el string del temaRandom5
          const themeRandomElo5 = profile?.elos?.plan5
            ? profile?.elos?.plan5[themeRandom5]
            : undefined;
          // se elige el elo mas bajo que el usuario tenga en el plan5, filtrando temas mapeados
          const themeWeakness5 = profile?.elos?.plan5
            ? this.getWeaknessInPlan(profile.elos.plan5, allowedThemes5)
            : this.getRandomTheme(allowedThemes5);

          const eloThemeWeakness5 = profile?.elos?.plan5
            ? profile?.elos?.plan5[themeWeakness5]
            : undefined;

          const block5: Block[] = [
            {
              time: 150,
              puzzlesCount: 0,
              theme: themeRandom5,
              // eslint-disable-next-line max-len
              description:
                this.translocoService.translate(
                  'PUZZLES.modes.randomThemeWith'
                ) + (color5 === 'white' ? whiteColorText : blackColorText),
              elo: themeRandomElo5 || defaultElo,
              color: color5,
              puzzleTimes: {
                warningOn: 12,
                dangerOn: 6,
                total: 15,
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
            },
            {
              time: 150,
              puzzlesCount: 0,
              theme: themeWeakness5,
              description:
                this.translocoService.translate('PUZZLES.modes.weaknessWith') +
                (color5 === 'white' ? whiteColorText : blackColorText),
              elo: eloThemeWeakness5 || defaultElo,
              color: color5,
              puzzleTimes: {
                warningOn: 24,
                dangerOn: 12,
                total: 30,
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
            },
          ];
          resolve(block5);
          break;
        case 'plan10': {
          /** Entrenamiento optimizado para engagement
           * Total: 10 minutos (600 segundos) - 4 bloques
           * Estructura: Calentamiento → Intensidad → Velocidad → Desafío
           */
          const allowedThemes10 = PLAN_ALLOWED_THEMES['plan10'];
          const color10 = Math.random() > 0.5 ? 'white' : 'black';

          const themeWarmup10 = this.getRandomTheme(allowedThemes10);
          const themeIntensity10 = profile?.elos?.plan10
            ? this.getWeaknessInPlan(profile.elos.plan10, allowedThemes10)
            : this.getRandomTheme(allowedThemes10);
          const themeChallenge10 = this.getRandomTheme(allowedThemes10);

          const eloWarmup10 = profile?.elos?.plan10
            ? profile.elos.plan10[themeWarmup10]
            : undefined;
          const eloIntensity10 = profile?.elos?.plan10
            ? profile.elos.plan10[themeIntensity10]
            : undefined;
          const eloChallenge10 = profile?.elos?.plan10
            ? profile.elos.plan10[themeChallenge10]
            : undefined;
          const eloMateIn110 = profile?.elos?.plan10
            ? profile.elos.plan10['mateIn1']
            : undefined;

          const block10: Block[] = [
            // 1. Calentamiento (2 min) - Entrada suave
            {
              time: 120,
              puzzlesCount: 0,
              theme: themeWarmup10,
              elo: eloWarmup10 || defaultElo,
              color: color10,
              puzzleTimes: {
                warningOn: 12,
                dangerOn: 6,
                total: 20,
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true,
            },
            // 2. Intensidad (3 min) - Enfoque en debilidades
            {
              time: 180,
              puzzlesCount: 0,
              theme: themeIntensity10,
              description:
                this.translocoService.translate('PUZZLES.modes.weaknessWith') +
                (color10 === 'white' ? whiteColorText : blackColorText),
              elo: eloIntensity10 || defaultElo,
              color: color10,
              puzzleTimes: {
                warningOn: 18,
                dangerOn: 9,
                total: 30,
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true,
            },
            // 3. Velocidad (2 min) - Adrenalina rápida
            {
              time: 120,
              puzzlesCount: 0,
              theme: 'mateIn1',
              elo: eloMateIn110 || defaultElo,
              color: color10,
              puzzleTimes: {
                warningOn: 6,
                dangerOn: 3,
                total: 10,
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true,
            },
            // 4. Desafío (3 min) - Satisfacción final
            {
              time: 180,
              puzzlesCount: 0,
              theme: themeChallenge10,
              elo: eloChallenge10 || defaultElo,
              color: color10,
              puzzleTimes: {
                warningOn: 40,
                dangerOn: 20,
                total: 60,
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true,
            },
          ];

          resolve(block10);
          break;
        }
        case 'plan20': {
          /** Entrenamiento optimizado para engagement
           * Total: 20 minutos (1200 segundos) - 5 bloques
           * Estructura: Calentamiento → Intensidad → Velocidad → Pico → Desafío → Enfriamiento
           */
          const allowedThemes20 = PLAN_ALLOWED_THEMES['plan20'];
          const themeWarmup20 = this.getRandomTheme(allowedThemes20);
          const themeIntensity20 = profile?.elos?.plan20
            ? this.getWeaknessInPlan(profile.elos.plan20, allowedThemes20)
            : this.getRandomTheme(allowedThemes20);
          const themePeak20 = this.getRandomTheme(allowedThemes20);
          const themeChallenge20 = this.getRandomTheme(allowedThemes20);

          const eloWarmup20 = profile?.elos?.plan20
            ? profile.elos.plan20[themeWarmup20]
            : undefined;
          const eloIntensity20 = profile?.elos?.plan20
            ? profile.elos.plan20[themeIntensity20]
            : undefined;
          const eloPeak20 = profile?.elos?.plan20
            ? profile.elos.plan20[themePeak20]
            : undefined;
          const eloChallenge20 = profile?.elos?.plan20
            ? profile.elos.plan20[themeChallenge20]
            : undefined;
          const eloMateIn120 = profile?.elos?.plan20
            ? profile.elos.plan20['mateIn1']
            : undefined;
          const eloEndgame20 = profile?.elos?.plan20
            ? profile.elos.plan20['endgame']
            : undefined;

          const block20: Block[] = [
            // 1. Calentamiento (3 min) - Entrada suave
            {
              time: 180,
              puzzlesCount: 0,
              theme: themeWarmup20,
              elo: eloWarmup20 || defaultElo,
              color: 'random',
              puzzleTimes: {
                warningOn: 15,
                dangerOn: 8,
                total: 25,
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true,
            },
            // 2. Intensidad (4 min) - Enfoque en debilidades
            {
              time: 240,
              puzzlesCount: 0,
              theme: themeIntensity20,
              description: this.translocoService.translate(
                'PUZZLES.modes.weaknessWithAnyColor'
              ),
              elo: eloIntensity20 || defaultElo,
              color: 'random',
              puzzleTimes: {
                warningOn: 18,
                dangerOn: 9,
                total: 30,
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true,
            },
            // 3. Velocidad (2 min) - Adrenalina rápida
            {
              time: 120,
              puzzlesCount: 0,
              theme: 'mateIn1',
              elo: eloMateIn120 || defaultElo,
              color: 'random',
              puzzleTimes: {
                warningOn: 6,
                dangerOn: 3,
                total: 10,
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true,
            },
            // 4. Pico (5 min) - Satisfacción máxima
            {
              time: 300,
              puzzlesCount: 0,
              theme: themePeak20,
              elo: eloPeak20 || defaultElo,
              color: 'random',
              puzzleTimes: {
                warningOn: 40,
                dangerOn: 20,
                total: 60,
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true,
            },
            // 5. Desafío (3 min) - Emoción final (50% ciegas, 50% rápido)
            Math.random() < 0.5
              ? {
                  time: 180,
                  puzzlesCount: 0,
                  theme: themeChallenge20,
                  description: this.translocoService.translate(
                    'PUZZLES.modes.sameOpeningRandomThemeBlind'
                  ),
                  elo: eloChallenge20 || defaultElo,
                  color: 'random',
                  puzzleTimes: {
                    warningOn: 10,
                    dangerOn: 5,
                    total: 15,
                  },
                  goshPuzzle: true,
                  goshPuzzleTime: 10,
                  puzzlesPlayed: [],
                  nextPuzzleImmediately: true,
                  showPuzzleSolution: true,
                }
              : {
                  time: 180,
                  puzzlesCount: 0,
                  theme: themeChallenge20,
                  description: this.translocoService.translate(
                    'PUZZLES.modes.sameRandomTheme'
                  ),
                  elo: eloChallenge20 || defaultElo,
                  color: 'random',
                  puzzleTimes: {
                    warningOn: 12,
                    dangerOn: 6,
                    total: 20,
                  },
                  puzzlesPlayed: [],
                  nextPuzzleImmediately: true,
                  showPuzzleSolution: true,
                },
            // 6. Enfriamiento (3 min) - Cierre relajado
            {
              time: 180,
              puzzlesCount: 0,
              theme: 'endgame',
              elo: eloEndgame20 || defaultElo,
              color: 'random',
              puzzleTimes: {
                warningOn: 30,
                dangerOn: 15,
                total: 50,
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true,
            },
          ];

          resolve(block20);
          break;
        }
        case 'plan30': {
          /** Entrenamiento optimizado para engagement
           * Total: 30 minutos (1800 segundos) - 5 bloques
           * Estructura: Calentamiento → Intensidad → Velocidad → Pico → Desafío → Enfriamiento
           */
          const allowedThemes30 = PLAN_ALLOWED_THEMES['plan30'];
          const color30 = Math.random() > 0.5 ? 'white' : 'black';

          const themeWarmup30 = this.getRandomTheme(allowedThemes30);
          const themeIntensity30 = profile?.elos?.plan30
            ? this.getWeaknessInPlan(profile.elos.plan30, allowedThemes30)
            : this.getRandomTheme(allowedThemes30);
          const themePeak30 = this.getRandomTheme(allowedThemes30);
          const themeChallenge30 = this.getRandomTheme(allowedThemes30);
          const themeSpeed30 = this.getRandomTheme(allowedThemes30);

          const eloWarmup30 = profile?.elos?.plan30
            ? profile.elos.plan30[themeWarmup30]
            : undefined;
          const eloIntensity30 = profile?.elos?.plan30
            ? profile.elos.plan30[themeIntensity30]
            : undefined;
          const eloPeak30 = profile?.elos?.plan30
            ? profile.elos.plan30[themePeak30]
            : undefined;
          const eloChallenge30 = profile?.elos?.plan30
            ? profile.elos.plan30[themeChallenge30]
            : undefined;
          const eloSpeed30 = profile?.elos?.plan30
            ? profile.elos.plan30[themeSpeed30]
            : undefined;
          const eloEndgame30 = profile?.elos?.plan30
            ? profile.elos.plan30['endgame']
            : undefined;
          const eloPawnEndgame30 = profile?.elos?.plan30
            ? profile.elos.plan30['pawnEndgame']
            : undefined;

          const block30: Block[] = [
            // 1. Calentamiento (4 min) - Entrada suave
            {
              time: 240,
              puzzlesCount: 0,
              theme: themeWarmup30,
              elo: eloWarmup30 || defaultElo,
              color: color30,
              puzzleTimes: {
                warningOn: 18,
                dangerOn: 9,
                total: 30,
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true,
            },
            // 2. Intensidad (6 min) - Enfoque en debilidades
            {
              time: 360,
              puzzlesCount: 0,
              theme: themeIntensity30,
              description:
                this.translocoService.translate('PUZZLES.modes.weaknessWith') +
                (color30 === 'white' ? whiteColorText : blackColorText),
              elo: eloIntensity30 || defaultElo,
              color: color30,
              puzzleTimes: {
                warningOn: 40,
                dangerOn: 20,
                total: 60,
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true,
            },
            // 3. Velocidad (3 min) - Adrenalina rápida (tema rápido permitido)
            {
              time: 180,
              puzzlesCount: 0,
              theme: themeSpeed30,
              elo: eloSpeed30 || defaultElo,
              color: color30,
              puzzleTimes: {
                warningOn: 12,
                dangerOn: 6,
                total: 20,
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true,
            },
            // 4. Pico (8 min) - Satisfacción máxima
            {
              time: 480,
              puzzlesCount: 0,
              theme: themePeak30,
              elo: eloPeak30 || defaultElo,
              color: color30,
              puzzleTimes: {
                warningOn: 60,
                dangerOn: 30,
                total: 90,
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true,
            },
            // 5. Desafío (4 min) - Emoción máxima (ciegas)
            {
              time: 240,
              puzzlesCount: 0,
              theme: themeChallenge30,
              description: this.translocoService.translate(
                'PUZZLES.modes.sameOpeningRandomThemeBlind'
              ),
              elo: eloChallenge30 || defaultElo,
              color: color30,
              puzzleTimes: {
                warningOn: 10,
                dangerOn: 5,
                total: 15,
              },
              goshPuzzle: true,
              goshPuzzleTime: 15,
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true,
            },
            // 6. Enfriamiento (5 min) - Cierre relajado
            {
              time: 300,
              puzzlesCount: 0,
              theme: Math.random() < 0.5 ? 'endgame' : 'pawnEndgame',
              elo:
                (Math.random() < 0.5 ? eloEndgame30 : eloPawnEndgame30) ||
                defaultElo,
              color: color30,
              puzzleTimes: {
                warningOn: 40,
                dangerOn: 20,
                total: 60,
              },
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true,
            },
          ];

          resolve(block30);
          break;
        }
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
          const eloBackToCalm =
            Math.floor(Math.random() * (defaultElo - defaultEloStart + 1)) +
            defaultEloStart;

          const blockBackToCalm: Block[] = [
            {
              time: -1,
              puzzlesCount: 3,
              theme: 'mate',
              elo: eloBackToCalm,
              color: colorBackToCalm,
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true,
            },
            {
              time: -1,
              puzzlesCount: 3,
              theme: 'mateIn2',
              elo: eloBackToCalm,
              color: colorBackToCalm,
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true,
            },
            {
              time: -1,
              puzzlesCount: 3,
              theme: 'mateIn1',
              elo: eloBackToCalm,
              color: colorBackToCalm,
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true,
            },
          ];

          resolve(blockBackToCalm);

          break;

        case 'infinity':
          const blockInfinity: Block[] = [
            {
              time: -1,
              puzzlesCount: 0,
              theme: this.getRandomTheme(),
              elo: defaultElo,
              color: Math.random() > 0.5 ? 'white' : 'black',
              puzzlesPlayed: [],
              nextPuzzleImmediately: true,
              showPuzzleSolution: true,
            },
          ];
          resolve(blockInfinity);
          break;
      }
    });
  }

  /**
   * Obtiene un tema random de la lista de temas.
   * Si se pasa allowedThemeValues (con elementos), solo se elige entre esos temas.
   */
  getRandomTheme(allowedThemeValues?: string[]): string {
    const list = this.appService.getThemesPuzzlesList;
    const filtered = allowedThemeValues?.length
      ? list.filter((t) => allowedThemeValues.includes(t.value))
      : [];
    const target = filtered.length > 0 ? filtered : list;
    return target[Math.floor(Math.random() * target.length)].value;
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
   * Obtiene el tema debil del usuario según el plan que se le pase.
   * Si se pasa allowedThemeValues, solo se consideran esos temas (debilidad dentro del subconjunto).
   */
  getWeaknessInPlan(
    plan: {
      [key: string]: number;
    },
    allowedThemeValues?: string[]
  ): string {
    const themesList = this.appService.getThemesPuzzlesList;
    let planElosFiltered: { [key: string]: number } = {};

    Object.keys(plan).forEach((key) => {
      if (!themesList.find((item) => item.value === key)) return;
      if (allowedThemeValues?.length && !allowedThemeValues.includes(key))
        return;
      planElosFiltered = { ...planElosFiltered, [key]: plan[key] };
    });
    let theme = this.plansElosService.getWeakness(planElosFiltered);
    if (!theme) {
      theme = this.getRandomTheme(allowedThemeValues);
    }
    return theme;
  }

  /**
   * Obtiene el tema más fuerte del usuario según el plan que se le pase.
   * Si se pasa allowedThemeValues, solo se consideran esos temas.
   */
  getStrongestThemeInPlan(
    plan: {
      [key: string]: number;
    },
    allowedThemeValues?: string[]
  ): string {
    const themesList = this.appService.getThemesPuzzlesList;
    let planElosFiltered: { [key: string]: number } = {};

    Object.keys(plan).forEach((key) => {
      if (!themesList.find((item) => item.value === key)) return;
      if (allowedThemeValues?.length && !allowedThemeValues.includes(key))
        return;
      planElosFiltered = { ...planElosFiltered, [key]: plan[key] };
    });
    let theme = this.plansElosService.getStrongestTheme(planElosFiltered);
    if (!theme) {
      theme = this.getRandomTheme(allowedThemeValues);
    }
    return theme;
  }

  /**
   * Obtiene la apertura débil del usuario
   * según el plan que se le pase
   * */
  getWeaknessInPlanOpenings(plan: { [key: string]: number }): string {
    // se filtra solo para devolver las aperturas que existan en la lista de la app
    const openingsList = this.appService.getOpeningsList;
    let planOpeningsFiltered: { [key: string]: number } = {};
    Object.keys(plan).forEach((key) => {
      if (openingsList.find((item) => item.value === key)) {
        planOpeningsFiltered = { ...planOpeningsFiltered, [key]: plan[key] };
      }
    });
    // se elige la apertura con el elo mas bajo que el usuario tenga en el plan,
    // sino elige una apertura random de la lista de aperturas
    let opening = this.plansElosService.getWeakness(planOpeningsFiltered);
    if (!opening) {
      opening =
        this.appService.getOpeningsList[
          Math.floor(Math.random() * this.appService.getOpeningsList.length)
        ].value;
    }

    return opening;
  }
}
