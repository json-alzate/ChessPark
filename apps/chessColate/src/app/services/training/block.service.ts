import { Injectable, inject } from '@angular/core';

import { TranslocoService } from '@jsverse/transloco';

import { Puzzle } from '@cpark/models';
import { Block } from '@cpark/models';
import { PlanTypes } from '@cpark/models';
import { PuzzleQueryOptions } from '@cpark/models';

// import { PlansElosService } from '@services/plans/plans-elos.service';
import { ProfileService } from '@services/account/profile.service';
import { AppService } from '@services/app/app.service';
import { PuzzlesProvider } from '@chesspark/puzzles-provider';
import { PlansElosService } from '@services/plans/plans-elos.service';
import { PLAN_ALLOWED_THEMES } from '../../plan-allowed-themes.config';
import {
  BlockSpec,
  DescriptionRule,
  PLAN_BLOCK_SPECS,
  PlanBlocksSpec,
  ThemeRule,
} from '../plans/plan-blocks.config';

/**
 * ELO de respaldo cuando el perfil no tiene dato para el tema.
 * Ver el TODO de eloFor sobre los fallbacks pendientes de unificar.
 */
const DEFAULT_ELO = 1500;
/** Rango del ELO aleatorio del plan backToCalm (extremos incluidos). */
const BACK_TO_CALM_MIN_ELO = 800;
const BACK_TO_CALM_MAX_ELO = 1500;

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
  { }

  async getPuzzlesForBlock(blockSettings: Block): Promise<Puzzle[]> {
    const themeMapped =
      blockSettings.theme &&
      this.appService.getThemesPuzzlesList.some(
        (t) => t.value === blockSettings.theme
      );

    const options: PuzzleQueryOptions = {
      elo: blockSettings.elo,
      ...(blockSettings.eloMin !== undefined && blockSettings.eloMax !== undefined
        ? { eloMin: blockSettings.eloMin, eloMax: blockSettings.eloMax }
        : {}),
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

  /**
   * Genera los bloques de un plan de entrenamiento.
   * Los planes de la tabla PLAN_BLOCK_SPECS se construyen desde su configuración.
   * infinity, backToCalm y reto333 tienen reglas propias.
   *
   * Si el plan no tiene configuración, la promesa se rechaza con un error claro
   * en lugar de quedar pendiente.
   */
  async generateBlocksForPlan(option: PlanTypes): Promise<Block[]> {
    const spec = PLAN_BLOCK_SPECS[option];
    if (spec) {
      return this.buildBlocksFromSpec(option, spec);
    }

    switch (option) {
      case 'infinity':
        return this.buildInfinityBlocks();
      case 'backToCalm':
        return this.buildBackToCalmBlocks();
      case 'reto333':
        return this.buildReto333Blocks();
      default:
        throw new Error(`No hay configuración de bloques para el plan "${option}"`);
    }
  }

  /**
   * Construye los bloques de un plan a partir de su configuración.
   *
   * El orden de los sorteos de Math.random es fijo: primero el color del plan,
   * después los temas en el orden de themeDrawOrder y, al final, la variante de
   * cada bloque. Cambiar ese orden altera los puzzles que salen con una misma semilla.
   */
  private buildBlocksFromSpec(plan: PlanTypes, spec: PlanBlocksSpec): Block[] {
    const planColor = spec.color === 'side' ? this.pickSide() : 'random';

    // Se sortean primero todos los temas, porque el ELO de un bloque puede depender
    // de un tema que se sortea después (ver eloTheme en plan-blocks.config.ts).
    const drawOrder = spec.themeDrawOrder ?? spec.blocks.map((_, index) => index);
    const themes: string[] = [];
    const eloThemes: string[] = [];
    for (const index of drawOrder) {
      const blockSpec = spec.blocks[index];
      themes[index] = this.resolveTheme(plan, blockSpec.theme);
      eloThemes[index] = blockSpec.eloTheme
        ? this.resolveTheme(plan, blockSpec.eloTheme)
        : themes[index];
    }

    return spec.blocks.map((blockSpec, index) => {
      const variant = blockSpec.variants
        ? blockSpec.variants[Math.random() < 0.5 ? 0 : 1]
        : undefined;
      return this.toBlock(
        plan,
        { ...blockSpec, ...variant },
        { theme: themes[index], eloTheme: eloThemes[index], color: planColor }
      );
    });
  }

  /**
   * Arma un bloque con los valores ya sorteados (tema, ELO y color) y con los
   * campos opcionales de su configuración. Solo incluye las claves que existen en
   * la configuración, para que el objeto solo tenga las claves que define el plan.
   */
  private toBlock(
    plan: PlanTypes,
    blockSpec: BlockSpec,
    drawn: { theme: string; eloTheme: string; color: Block['color'] }
  ): Block {
    const block: Block = {
      time: blockSpec.time,
      puzzlesCount: blockSpec.puzzlesCount,
      theme: drawn.theme,
      elo: this.eloFor(plan, drawn.eloTheme),
      color: drawn.color,
      puzzlesPlayed: [],
    };

    if (blockSpec.description) {
      block.description = this.describe(blockSpec.description, drawn.color);
    }
    if (blockSpec.puzzleTimes) {
      block.puzzleTimes = { ...blockSpec.puzzleTimes };
    }
    if (blockSpec.goshPuzzleTime !== undefined) {
      block.goshPuzzle = true;
      block.goshPuzzleTime = blockSpec.goshPuzzleTime;
    }
    if (blockSpec.showPuzzleSolution !== undefined) {
      block.showPuzzleSolution = blockSpec.showPuzzleSolution;
    }
    if (blockSpec.nextPuzzleImmediately !== undefined) {
      block.nextPuzzleImmediately = blockSpec.nextPuzzleImmediately;
    }

    return block;
  }

  /**
   * Elige el tema de un bloque según su regla.
   * Las reglas weakness y strongest usan los elos del usuario en el plan; si no los
   * tiene, eligen un tema al azar entre los permitidos del plan.
   */
  private resolveTheme(plan: PlanTypes, rule: ThemeRule): string {
    const allowed = PLAN_ALLOWED_THEMES[plan];

    switch (rule.strategy) {
      case 'fixed':
        return rule.theme;
      case 'oneOf':
        return rule.themes[Math.floor(Math.random() * rule.themes.length)];
      case 'random': {
        const theme = this.getRandomTheme(allowed);
        if (rule.rejectIfEmpty && !theme) {
          throw 'No se pudo obtener el tema random themeRandom5';
        }
        return theme;
      }
      case 'weakness': {
        const planElos = this.planElos(plan);
        return planElos
          ? this.getWeaknessInPlan(planElos, allowed)
          : this.getRandomTheme(allowed);
      }
      case 'strongest': {
        const planElos = this.planElos(plan);
        return planElos
          ? this.getStrongestThemeInPlan(planElos, allowed)
          : this.getRandomTheme(allowed);
      }
    }
  }

  /**
   * Devuelve el texto de descripción de un bloque.
   * El texto del color (blancas o negras) sale de las traducciones de PUZZLES.colors.
   */
  private describe(rule: DescriptionRule, color: Block['color']): string {
    const sideText =
      color === 'white'
        ? this.translocoService.translate('PUZZLES.colors.white')
        : this.translocoService.translate('PUZZLES.colors.black');

    if ('side' in rule) {
      return sideText;
    }
    if ('text' in rule) {
      return rule.text;
    }
    return this.translocoService.translate(rule.key) + (rule.withSide ? sideText : '');
  }

  /**
   * Elige blancas o negras al azar. Se usa un solo sorteo para todo el plan.
   */
  private pickSide(): 'white' | 'black' {
    return Math.random() > 0.5 ? 'white' : 'black';
  }

  /**
   * ELO del usuario para un tema dentro de un plan.
   * Si el perfil no tiene el dato, devuelve el valor de fallback.
   *
   * TODO: los fallbacks de ELO no están unificados. Aquí son 1500, reto333 usa 400 y
   * backToCalm usa un rango aleatorio. Unificarlos es una decisión de producto pendiente,
   * por ahora se mantienen tal cual.
   */
  private eloFor(plan: PlanTypes, theme: string, fallback = DEFAULT_ELO): number {
    return this.planElos(plan)?.[theme] || fallback;
  }

  /**
   * Elos del usuario para un plan (por ejemplo warmup o plan10).
   * Devuelve undefined si no hay perfil o si el perfil no tiene elos de ese plan.
   */
  private planElos(plan: PlanTypes): Record<string, number> | undefined {
    const elos = this.profileService.getProfile?.elos as
      | Partial<Record<PlanTypes, Record<string, number>>>
      | undefined;
    return elos?.[plan];
  }

  /**
   * Plan infinity: un único bloque sin límite de tiempo ni de puzzles.
   * Los puzzles vienen del pool (InfinityPuzzlePoolService), que es
   * mixto en tema y en color: el bloque no filtra ninguno de los dos.
   * 'random' hace que la etiqueta se derive del FEN de cada puzzle.
   */
  private buildInfinityBlocks(): Block[] {
    return [
      {
        time: -1,
        puzzlesCount: 0,
        theme: '',
        elo: this.profileService.getEloTotalByPlanType('infinity'),
        color: 'random',
        puzzlesPlayed: [],
        nextPuzzleImmediately: true,
        showPuzzleSolution: true,
        showPuzzleElo: true,
      },
    ];
  }

  /**
   * Plan backToCalm: tres bloques de mates (mate, mate en 2 y mate en 1) de 3 puzzles
   * cada uno, con la solución visible y un mismo color.
   * Todos los bloques comparten un ELO aleatorio entre 800 y 1500.
   *
   * TODO: el rango aleatorio es una excepción de los fallbacks de ELO (ver eloFor).
   */
  private buildBackToCalmBlocks(): Block[] {
    const color = this.pickSide();
    const elo =
      Math.floor(Math.random() * (BACK_TO_CALM_MAX_ELO - BACK_TO_CALM_MIN_ELO + 1)) +
      BACK_TO_CALM_MIN_ELO;

    return ['mate', 'mateIn2', 'mateIn1'].map((theme) => ({
      time: -1,
      puzzlesCount: 3,
      theme,
      elo,
      color,
      puzzlesPlayed: [],
      nextPuzzleImmediately: true,
      showPuzzleSolution: true,
    }));
  }

  /**
   * Plan reto333: 333 mates en 1 con un ELO fijo de 400, sin límite de tiempo.
   *
   * TODO: el ELO fijo de 400 es una excepción de los fallbacks de ELO (ver eloFor).
   */
  private buildReto333Blocks(): Block[] {
    return [
      {
        time: -1,
        puzzlesCount: 333,
        theme: 'mateIn1',
        description: 'Mate en 1',
        elo: 400,
        color: 'random',
        puzzlesPlayed: [],
        nextPuzzleImmediately: true,
        showPuzzleSolution: true,
      },
    ];
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
