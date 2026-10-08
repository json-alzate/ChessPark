import { TestBed } from '@angular/core/testing';

import { TranslocoService } from '@jsverse/transloco';

import { PlanTypes, Profile } from '@chesspark/models';
import { PuzzlesProvider } from '@chesspark/puzzles-provider';

import { AppService } from '@services/app/app.service';
import { BlockService } from '@services/training/block.service';
import { PlansElosService } from '@services/plans/plans-elos.service';
import { ProfileService } from '@services/account/profile.service';

/** Temas disponibles en la app (unión de los permitidos por plan). */
const APP_THEMES = [
  'mate', 'mateIn1', 'mateIn2', 'mateIn3', 'mateIn4', 'mateIn5',
  'short', 'long', 'veryLong', 'oneMove', 'endgame', 'pawnEndgame',
  'rookEndgame', 'bishopEndgame', 'knightEndgame', 'queenEndgame',
  'queenRookEndgame', 'opening', 'middlegame', 'fork', 'pin', 'skewer',
  'hangingPiece', 'discoveredAttack', 'doubleCheck', 'sacrifice',
  'backRankMate', 'smotheredMate', 'hookMate', 'attraction', 'deflection',
  'interference', 'intermezzo', 'quietMove', 'capturingDefender',
  'exposedKing', 'kingsideAttack', 'queensideAttack', 'trappedPiece',
  'clearance', 'defensiveMove', 'xRayAttack', 'zugzwang', 'equality',
  'advantage', 'crushing',
];

/** Genera un mapa tema -> elo con valores distintos (sin empates) para el fixture. */
const spread = (themes: string[], base: number): Record<string, number> =>
  Object.fromEntries(themes.map((theme, i) => [theme, base + i * 7]));

/**
 * Perfil fixture con elos por plan. Cada plan incluye los temas que usa el
 * servicio, para que la lectura de ELO y la elección de debilidad sean reales.
 */
const profileFixture = {
  elos: {
    warmup: { mateIn1: 900, mateIn2: 950, mate: 1000 },
    plan1: { short: 1100 },
    plan3: spread(['opening', 'middlegame', 'endgame', 'fork', 'pin', 'skewer', 'hangingPiece', 'mateIn1', 'mateIn2', 'short', 'oneMove'], 1000),
    plan5: spread(['opening', 'middlegame', 'endgame', 'fork', 'pin', 'skewer', 'discoveredAttack', 'doubleCheck', 'sacrifice', 'mateIn1', 'mateIn2', 'mateIn3', 'backRankMate', 'short', 'long', 'oneMove'], 1200),
    plan10: spread(['opening', 'middlegame', 'endgame', 'rookEndgame', 'bishopEndgame', 'pawnEndgame', 'fork', 'pin', 'skewer', 'discoveredAttack', 'doubleCheck', 'sacrifice', 'attraction', 'deflection', 'mate', 'mateIn1', 'mateIn2', 'mateIn3', 'backRankMate', 'smotheredMate', 'short', 'long', 'oneMove'], 1300),
    plan20: spread(['opening', 'middlegame', 'endgame', 'rookEndgame', 'bishopEndgame', 'pawnEndgame', 'knightEndgame', 'queenEndgame', 'queenRookEndgame', 'fork', 'pin', 'skewer', 'discoveredAttack', 'doubleCheck', 'sacrifice', 'attraction', 'deflection', 'interference', 'intermezzo', 'quietMove', 'mate', 'mateIn1', 'mateIn2', 'mateIn3', 'mateIn4', 'backRankMate', 'smotheredMate', 'hookMate', 'short', 'long', 'veryLong', 'oneMove'], 1400),
    plan30: spread(['opening', 'middlegame', 'endgame', 'rookEndgame', 'bishopEndgame', 'pawnEndgame', 'knightEndgame', 'queenEndgame', 'queenRookEndgame', 'fork', 'pin', 'skewer', 'discoveredAttack', 'doubleCheck', 'sacrifice', 'capturingDefender', 'exposedKing', 'hangingPiece', 'kingsideAttack', 'queensideAttack', 'trappedPiece', 'attraction', 'clearance', 'defensiveMove', 'deflection', 'interference', 'intermezzo', 'quietMove', 'xRayAttack', 'zugzwang', 'mate', 'mateIn2', 'mateIn3', 'mateIn4', 'mateIn5', 'backRankMate', 'long', 'veryLong', 'equality', 'advantage', 'crushing'], 1500),
  },
};

/** Traducciones: devuelve la misma clave, así las descripciones son legibles en los tests. */
const translocoMock = { translate: (key: string) => key };

/** Devuelve el mínimo (o máximo) del mapa, igual que PlansElosService real. */
const weakestOf = (plan: Record<string, number>): string | null => {
  const entries = Object.entries(plan);
  if (!entries.length) return null;
  return entries.reduce((min, cur) => (cur[1] < min[1] ? cur : min))[0];
};
const strongestOf = (plan: Record<string, number>): string | null => {
  const entries = Object.entries(plan);
  if (!entries.length) return null;
  return entries.reduce((max, cur) => (cur[1] > max[1] ? cur : max))[0];
};

/**
 * Reemplaza Math.random por una secuencia fija de valores.
 * Así cada test fija exactamente qué color y qué temas salen, y el orden de llamadas.
 */
const mockRandom = (...values: number[]) => {
  const queue = [...values];
  return jest.spyOn(Math, 'random').mockImplementation(() => {
    const next = queue.shift();
    return next === undefined ? 0 : next;
  });
};

describe('BlockService (caracterización de generateBlocksForPlan)', () => {
  let service: BlockService;
  let profile: Profile | null;

  beforeEach(() => {
    profile = profileFixture as unknown as Profile;

    TestBed.configureTestingModule({
      providers: [
        BlockService,
        { provide: TranslocoService, useValue: translocoMock },
        {
          provide: ProfileService,
          useValue: {
            get getProfile() {
              return profile;
            },
            getEloTotalByPlanType: (planType: PlanTypes) =>
              planType === 'infinity' ? 1234 : 1500,
          },
        },
        {
          provide: AppService,
          useValue: {
            getThemesPuzzlesList: APP_THEMES.map((value) => ({ value, nameEs: value })),
            getOpeningsList: [{ value: 'Sicilian Defense' }],
          },
        },
        { provide: PuzzlesProvider, useValue: {} },
        {
          provide: PlansElosService,
          useValue: {
            getWeakness: weakestOf,
            getStrongestTheme: strongestOf,
          },
        },
      ],
    });

    service = TestBed.inject(BlockService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('con perfil del usuario', () => {
    it('warmup', async () => {
      mockRandom(...[0.8, 0.3, 0.6, 0.1, 0.9, 0.4, 0.7, 0.2, 0.55, 0.45]);
      const blocks = await service.generateBlocksForPlan('warmup');
      expect(blocks).toEqual([
        {
          time: 60,
          puzzlesCount: 0,
          theme: 'mateIn1',
          elo: 900,
          color: 'white',
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
          elo: 950,
          color: 'white',
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
          elo: 1000,
          puzzlesPlayed: [],
          color: 'white',
          showPuzzleSolution: true,
        },
      ]);
    });

    it('plan1', async () => {
      mockRandom(...[0.8, 0.3, 0.6, 0.1, 0.9, 0.4, 0.7, 0.2, 0.55, 0.45]);
      const blocks = await service.generateBlocksForPlan('plan1');
      expect(blocks).toEqual([
        {
          time: 60,
          puzzlesCount: 0,
          theme: 'short',
          description: 'PUZZLES.colors.white',
          elo: 1100,
          color: 'white',
          puzzleTimes: {
            warningOn: 6,
            dangerOn: 3,
            total: 10,
          },
          puzzlesPlayed: [],
          nextPuzzleImmediately: true,
        },
      ]);
    });

    it('plan3', async () => {
      mockRandom(...[0.8, 0.3, 0.6, 0.1, 0.9, 0.4, 0.7, 0.2, 0.55, 0.45]);
      const blocks = await service.generateBlocksForPlan('plan3');
      expect(blocks).toEqual([
        {
          time: 180,
          puzzlesCount: 0,
          theme: 'oneMove',
          description: 'PUZZLES.colors.white',
          elo: 1070,
          color: 'white',
          puzzleTimes: {
            warningOn: 12,
            dangerOn: 6,
            total: 20,
          },
          puzzlesPlayed: [],
          nextPuzzleImmediately: true,
        },
      ]);
    });

    it('plan5', async () => {
      mockRandom(...[0.8, 0.3, 0.6, 0.1, 0.9, 0.4, 0.7, 0.2, 0.55, 0.45]);
      const blocks = await service.generateBlocksForPlan('plan5');
      expect(blocks).toEqual([
        {
          time: 150,
          puzzlesCount: 0,
          theme: 'long',
          description: 'PUZZLES.modes.randomThemeWithPUZZLES.colors.white',
          elo: 1298,
          color: 'white',
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
          theme: 'opening',
          description: 'PUZZLES.modes.weaknessWithPUZZLES.colors.white',
          elo: 1200,
          color: 'white',
          puzzleTimes: {
            warningOn: 24,
            dangerOn: 12,
            total: 30,
          },
          puzzlesPlayed: [],
          nextPuzzleImmediately: true,
        },
      ]);
    });

    it('plan10', async () => {
      mockRandom(...[0.8, 0.3, 0.6, 0.1, 0.9, 0.4, 0.7, 0.2, 0.55, 0.45]);
      const blocks = await service.generateBlocksForPlan('plan10');
      expect(blocks).toEqual([
        {
          time: 120,
          puzzlesCount: 0,
          theme: 'oneMove',
          elo: 1454,
          color: 'white',
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
          time: 180,
          puzzlesCount: 0,
          theme: 'opening',
          description: 'PUZZLES.modes.weaknessWithPUZZLES.colors.white',
          elo: 1300,
          color: 'white',
          puzzleTimes: {
            warningOn: 18,
            dangerOn: 9,
            total: 30,
          },
          puzzlesPlayed: [],
          nextPuzzleImmediately: true,
          showPuzzleSolution: true,
        },
        {
          time: 120,
          puzzlesCount: 0,
          theme: 'mateIn1',
          elo: 1405,
          color: 'white',
          puzzleTimes: {
            warningOn: 6,
            dangerOn: 3,
            total: 10,
          },
          puzzlesPlayed: [],
          nextPuzzleImmediately: true,
          showPuzzleSolution: true,
        },
        {
          time: 180,
          puzzlesCount: 0,
          theme: 'fork',
          elo: 1342,
          color: 'white',
          puzzleTimes: {
            warningOn: 40,
            dangerOn: 20,
            total: 60,
          },
          puzzlesPlayed: [],
          nextPuzzleImmediately: true,
          showPuzzleSolution: true,
        },
      ]);
    });

    it('plan20', async () => {
      mockRandom(...[0.8, 0.3, 0.6, 0.1, 0.9, 0.4, 0.7, 0.2, 0.55, 0.45]);
      const blocks = await service.generateBlocksForPlan('plan20');
      expect(blocks).toEqual([
        {
          time: 180,
          puzzlesCount: 0,
          theme: 'smotheredMate',
          elo: 1582,
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
        {
          time: 240,
          puzzlesCount: 0,
          theme: 'opening',
          description: 'PUZZLES.modes.weaknessWithAnyColor',
          elo: 1400,
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
        {
          time: 120,
          puzzlesCount: 0,
          theme: 'mateIn1',
          elo: 1547,
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
        {
          time: 300,
          puzzlesCount: 0,
          theme: 'endgame',
          elo: 1414,
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
        {
          time: 180,
          puzzlesCount: 0,
          theme: 'pin',
          description: 'PUZZLES.modes.sameOpeningRandomThemeBlind',
          elo: 1470,
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
        },
        {
          time: 180,
          puzzlesCount: 0,
          theme: 'endgame',
          elo: 1414,
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
      ]);
    });

    it('plan30', async () => {
      mockRandom(...[0.8, 0.3, 0.6, 0.1, 0.9, 0.4, 0.7, 0.2, 0.55, 0.45]);
      const blocks = await service.generateBlocksForPlan('plan30');
      expect(blocks).toEqual([
        {
          time: 240,
          puzzlesCount: 0,
          theme: 'queenEndgame',
          elo: 1549,
          color: 'white',
          puzzleTimes: {
            warningOn: 18,
            dangerOn: 9,
            total: 30,
          },
          puzzlesPlayed: [],
          nextPuzzleImmediately: true,
          showPuzzleSolution: true,
        },
        {
          time: 360,
          puzzlesCount: 0,
          theme: 'opening',
          description: 'PUZZLES.modes.weaknessWithPUZZLES.colors.white',
          elo: 1500,
          color: 'white',
          puzzleTimes: {
            warningOn: 40,
            dangerOn: 20,
            total: 60,
          },
          puzzlesPlayed: [],
          nextPuzzleImmediately: true,
          showPuzzleSolution: true,
        },
        {
          time: 180,
          puzzlesCount: 0,
          theme: 'xRayAttack',
          elo: 1696,
          color: 'white',
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
          time: 480,
          puzzlesCount: 0,
          theme: 'attraction',
          elo: 1647,
          color: 'white',
          puzzleTimes: {
            warningOn: 60,
            dangerOn: 30,
            total: 90,
          },
          puzzlesPlayed: [],
          nextPuzzleImmediately: true,
          showPuzzleSolution: true,
        },
        {
          time: 240,
          puzzlesCount: 0,
          theme: 'mateIn5',
          description: 'PUZZLES.modes.sameOpeningRandomThemeBlind',
          elo: 1738,
          color: 'white',
          puzzleTimes: {
            warningOn: 10,
            dangerOn: 5,
            total: 35,
          },
          goshPuzzle: true,
          goshPuzzleTime: 15,
          puzzlesPlayed: [],
          nextPuzzleImmediately: true,
          showPuzzleSolution: true,
        },
        {
          time: 300,
          puzzlesCount: 0,
          theme: 'endgame',
          // ELO de 'endgame' en el fixture (1500 + 2 * 7). El ELO sale del mismo tema
          // que se muestra; antes salía de otro sorteo y daba el de 'pawnEndgame' (1535).
          elo: 1514,
          color: 'white',
          puzzleTimes: {
            warningOn: 40,
            dangerOn: 20,
            total: 60,
          },
          puzzlesPlayed: [],
          nextPuzzleImmediately: true,
          showPuzzleSolution: true,
        },
      ]);
    });

    it('backToCalm', async () => {
      mockRandom(...[0.8, 0.3, 0.6, 0.1, 0.9, 0.4, 0.7, 0.2, 0.55, 0.45]);
      const blocks = await service.generateBlocksForPlan('backToCalm');
      expect(blocks).toEqual([
        {
          time: -1,
          puzzlesCount: 3,
          theme: 'mate',
          elo: 860,
          color: 'white',
          puzzlesPlayed: [],
          nextPuzzleImmediately: true,
          showPuzzleSolution: true,
        },
        {
          time: -1,
          puzzlesCount: 3,
          theme: 'mateIn2',
          elo: 860,
          color: 'white',
          puzzlesPlayed: [],
          nextPuzzleImmediately: true,
          showPuzzleSolution: true,
        },
        {
          time: -1,
          puzzlesCount: 3,
          theme: 'mateIn1',
          elo: 860,
          color: 'white',
          puzzlesPlayed: [],
          nextPuzzleImmediately: true,
          showPuzzleSolution: true,
        },
      ]);
    });

    it('infinity', async () => {
      mockRandom(...[0.8, 0.3, 0.6, 0.1, 0.9, 0.4, 0.7, 0.2, 0.55, 0.45]);
      const blocks = await service.generateBlocksForPlan('infinity');
      expect(blocks).toEqual([
        {
          time: -1,
          puzzlesCount: 0,
          theme: '',
          elo: 1234,
          color: 'random',
          puzzlesPlayed: [],
          nextPuzzleImmediately: true,
          showPuzzleSolution: true,
          showPuzzleElo: true,
        },
      ]);
    });

    it('reto333', async () => {
      mockRandom(...[0.8, 0.3, 0.6, 0.1, 0.9, 0.4, 0.7, 0.2, 0.55, 0.45]);
      const blocks = await service.generateBlocksForPlan('reto333');
      expect(blocks).toEqual([
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
      ]);
    });

  });

  describe('sin perfil (fallbacks de ELO)', () => {
    it('warmup', async () => {
      profile = null;
      mockRandom(...[0.5, 0.9, 0.1, 0.6, 0.3, 0.8, 0.45, 0.7, 0.05, 0.95]);
      const blocks = await service.generateBlocksForPlan('warmup');
      expect(blocks).toEqual([
        {
          time: 60,
          puzzlesCount: 0,
          theme: 'mateIn1',
          elo: 1500,
          color: 'black',
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
          elo: 1500,
          color: 'black',
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
          elo: 1500,
          puzzlesPlayed: [],
          color: 'black',
          showPuzzleSolution: true,
        },
      ]);
    });

    it('plan1', async () => {
      profile = null;
      mockRandom(...[0.5, 0.9, 0.1, 0.6, 0.3, 0.8, 0.45, 0.7, 0.05, 0.95]);
      const blocks = await service.generateBlocksForPlan('plan1');
      expect(blocks).toEqual([
        {
          time: 60,
          puzzlesCount: 0,
          theme: 'short',
          description: 'PUZZLES.colors.black',
          elo: 1500,
          color: 'black',
          puzzleTimes: {
            warningOn: 6,
            dangerOn: 3,
            total: 10,
          },
          puzzlesPlayed: [],
          nextPuzzleImmediately: true,
        },
      ]);
    });

    it('plan3', async () => {
      profile = null;
      mockRandom(...[0.5, 0.9, 0.1, 0.6, 0.3, 0.8, 0.45, 0.7, 0.05, 0.95]);
      const blocks = await service.generateBlocksForPlan('plan3');
      expect(blocks).toEqual([
        {
          time: 180,
          puzzlesCount: 0,
          theme: 'skewer',
          description: 'PUZZLES.colors.black',
          elo: 1500,
          color: 'black',
          puzzleTimes: {
            warningOn: 12,
            dangerOn: 6,
            total: 20,
          },
          puzzlesPlayed: [],
          nextPuzzleImmediately: true,
        },
      ]);
    });

    it('plan5', async () => {
      profile = null;
      mockRandom(...[0.5, 0.9, 0.1, 0.6, 0.3, 0.8, 0.45, 0.7, 0.05, 0.95]);
      const blocks = await service.generateBlocksForPlan('plan5');
      expect(blocks).toEqual([
        {
          time: 150,
          puzzlesCount: 0,
          theme: 'sacrifice',
          description: 'PUZZLES.modes.randomThemeWithPUZZLES.colors.black',
          elo: 1500,
          color: 'black',
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
          theme: 'mateIn2',
          description: 'PUZZLES.modes.weaknessWithPUZZLES.colors.black',
          elo: 1500,
          color: 'black',
          puzzleTimes: {
            warningOn: 24,
            dangerOn: 12,
            total: 30,
          },
          puzzlesPlayed: [],
          nextPuzzleImmediately: true,
        },
      ]);
    });

    it('plan10', async () => {
      profile = null;
      mockRandom(...[0.5, 0.9, 0.1, 0.6, 0.3, 0.8, 0.45, 0.7, 0.05, 0.95]);
      const blocks = await service.generateBlocksForPlan('plan10');
      expect(blocks).toEqual([
        {
          time: 120,
          puzzlesCount: 0,
          theme: 'smotheredMate',
          elo: 1500,
          color: 'black',
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
          time: 180,
          puzzlesCount: 0,
          theme: 'mateIn2',
          description: 'PUZZLES.modes.weaknessWithPUZZLES.colors.black',
          elo: 1500,
          color: 'black',
          puzzleTimes: {
            warningOn: 18,
            dangerOn: 9,
            total: 30,
          },
          puzzlesPlayed: [],
          nextPuzzleImmediately: true,
          showPuzzleSolution: true,
        },
        {
          time: 120,
          puzzlesCount: 0,
          theme: 'mateIn1',
          elo: 1500,
          color: 'black',
          puzzleTimes: {
            warningOn: 6,
            dangerOn: 3,
            total: 10,
          },
          puzzlesPlayed: [],
          nextPuzzleImmediately: true,
          showPuzzleSolution: true,
        },
        {
          time: 180,
          puzzlesCount: 0,
          theme: 'fork',
          elo: 1500,
          color: 'black',
          puzzleTimes: {
            warningOn: 40,
            dangerOn: 20,
            total: 60,
          },
          puzzlesPlayed: [],
          nextPuzzleImmediately: true,
          showPuzzleSolution: true,
        },
      ]);
    });

    it('plan20', async () => {
      profile = null;
      mockRandom(...[0.5, 0.9, 0.1, 0.6, 0.3, 0.8, 0.45, 0.7, 0.05, 0.95]);
      const blocks = await service.generateBlocksForPlan('plan20');
      expect(blocks).toEqual([
        {
          time: 180,
          puzzlesCount: 0,
          theme: 'opening',
          elo: 1500,
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
        {
          time: 240,
          puzzlesCount: 0,
          theme: 'deflection',
          description: 'PUZZLES.modes.weaknessWithAnyColor',
          elo: 1500,
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
        {
          time: 120,
          puzzlesCount: 0,
          theme: 'mateIn1',
          elo: 1500,
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
        {
          time: 300,
          puzzlesCount: 0,
          theme: 'mateIn3',
          elo: 1500,
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
        {
          time: 180,
          puzzlesCount: 0,
          theme: 'pin',
          description: 'PUZZLES.modes.sameOpeningRandomThemeBlind',
          elo: 1500,
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
        },
        {
          time: 180,
          puzzlesCount: 0,
          theme: 'endgame',
          elo: 1500,
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
      ]);
    });

    it('plan30', async () => {
      profile = null;
      mockRandom(...[0.5, 0.9, 0.1, 0.6, 0.3, 0.8, 0.45, 0.7, 0.05, 0.95]);
      const blocks = await service.generateBlocksForPlan('plan30');
      expect(blocks).toEqual([
        {
          time: 240,
          puzzlesCount: 0,
          theme: 'xRayAttack',
          elo: 1500,
          color: 'black',
          puzzleTimes: {
            warningOn: 18,
            dangerOn: 9,
            total: 30,
          },
          puzzlesPlayed: [],
          nextPuzzleImmediately: true,
          showPuzzleSolution: true,
        },
        {
          time: 360,
          puzzlesCount: 0,
          theme: 'mateIn5',
          description: 'PUZZLES.modes.weaknessWithPUZZLES.colors.black',
          elo: 1500,
          color: 'black',
          puzzleTimes: {
            warningOn: 40,
            dangerOn: 20,
            total: 60,
          },
          puzzlesPlayed: [],
          nextPuzzleImmediately: true,
          showPuzzleSolution: true,
        },
        {
          time: 180,
          puzzlesCount: 0,
          theme: 'queensideAttack',
          elo: 1500,
          color: 'black',
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
          time: 480,
          puzzlesCount: 0,
          theme: 'attraction',
          elo: 1500,
          color: 'black',
          puzzleTimes: {
            warningOn: 60,
            dangerOn: 30,
            total: 90,
          },
          puzzlesPlayed: [],
          nextPuzzleImmediately: true,
          showPuzzleSolution: true,
        },
        {
          time: 240,
          puzzlesCount: 0,
          theme: 'queenEndgame',
          description: 'PUZZLES.modes.sameOpeningRandomThemeBlind',
          elo: 1500,
          color: 'black',
          puzzleTimes: {
            warningOn: 10,
            dangerOn: 5,
            total: 35,
          },
          goshPuzzle: true,
          goshPuzzleTime: 15,
          puzzlesPlayed: [],
          nextPuzzleImmediately: true,
          showPuzzleSolution: true,
        },
        {
          time: 300,
          puzzlesCount: 0,
          theme: 'endgame',
          elo: 1500,
          color: 'black',
          puzzleTimes: {
            warningOn: 40,
            dangerOn: 20,
            total: 60,
          },
          puzzlesPlayed: [],
          nextPuzzleImmediately: true,
          showPuzzleSolution: true,
        },
      ]);
    });

    it('backToCalm', async () => {
      profile = null;
      mockRandom(...[0.5, 0.9, 0.1, 0.6, 0.3, 0.8, 0.45, 0.7, 0.05, 0.95]);
      const blocks = await service.generateBlocksForPlan('backToCalm');
      expect(blocks).toEqual([
        {
          time: -1,
          puzzlesCount: 3,
          theme: 'mate',
          elo: 980,
          color: 'black',
          puzzlesPlayed: [],
          nextPuzzleImmediately: true,
          showPuzzleSolution: true,
        },
        {
          time: -1,
          puzzlesCount: 3,
          theme: 'mateIn2',
          elo: 980,
          color: 'black',
          puzzlesPlayed: [],
          nextPuzzleImmediately: true,
          showPuzzleSolution: true,
        },
        {
          time: -1,
          puzzlesCount: 3,
          theme: 'mateIn1',
          elo: 980,
          color: 'black',
          puzzlesPlayed: [],
          nextPuzzleImmediately: true,
          showPuzzleSolution: true,
        },
      ]);
    });

    it('infinity', async () => {
      profile = null;
      mockRandom(...[0.5, 0.9, 0.1, 0.6, 0.3, 0.8, 0.45, 0.7, 0.05, 0.95]);
      const blocks = await service.generateBlocksForPlan('infinity');
      expect(blocks).toEqual([
        {
          time: -1,
          puzzlesCount: 0,
          theme: '',
          elo: 1234,
          color: 'random',
          puzzlesPlayed: [],
          nextPuzzleImmediately: true,
          showPuzzleSolution: true,
          showPuzzleElo: true,
        },
      ]);
    });

    it('reto333', async () => {
      profile = null;
      mockRandom(...[0.5, 0.9, 0.1, 0.6, 0.3, 0.8, 0.45, 0.7, 0.05, 0.95]);
      const blocks = await service.generateBlocksForPlan('reto333');
      expect(blocks).toEqual([
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
      ]);
    });
  });

  describe('rangos de ELO y bloques sin sorteo', () => {
    it('backToCalm usa el extremo inferior 800 cuando Math.random devuelve 0', async () => {
      mockRandom(0, 0);
      const blocks = await service.generateBlocksForPlan('backToCalm');
      expect(blocks.map((b) => b.elo)).toEqual([800, 800, 800]);
      expect(blocks[0].color).toBe('black');
    });

    it('backToCalm usa el extremo superior 1000 cuando Math.random se acerca a 1', async () => {
      mockRandom(0.9, 0.9999);
      const blocks = await service.generateBlocksForPlan('backToCalm');
      expect(blocks.map((b) => b.elo)).toEqual([1000, 1000, 1000]);
      expect(blocks[0].color).toBe('white');
    });

    it('backToCalm nunca sale del rango 800-1000, sea cual sea el sorteo', async () => {
      for (const r of [0, 0.001, 0.25, 0.5, 0.75, 0.999, 0.9999]) {
        jest.restoreAllMocks();
        mockRandom(0.9, r);
        const blocks = await service.generateBlocksForPlan('backToCalm');
        expect(blocks[0].elo).toBeGreaterThanOrEqual(800);
        expect(blocks[0].elo).toBeLessThanOrEqual(1000);
      }
    });

    it('plan30: el ELO del enfriamiento corresponde siempre al tema que se muestra', async () => {
      const plan30Elos = (profile as { elos: { plan30: Record<string, number> } }).elos.plan30;
      // Se recorren varios sorteos para que salgan tanto 'endgame' como 'pawnEndgame'
      const seen = new Set<string>();
      for (const r of [0, 0.2, 0.49, 0.5, 0.51, 0.8, 0.99]) {
        jest.restoreAllMocks();
        mockRandom(0.8, 0.3, 0.6, 0.1, 0.9, r, r, r, r, r);
        const blocks = await service.generateBlocksForPlan('plan30');
        const cooldown = blocks[blocks.length - 1];
        seen.add(cooldown.theme);
        expect(['endgame', 'pawnEndgame']).toContain(cooldown.theme);
        expect(cooldown.elo).toBe(plan30Elos[cooldown.theme]);
      }
      // Los dos temas tienen un ELO distinto en el fixture: si el test no ve ambos
      // temas, no estaría comprobando nada.
      expect(seen.size).toBe(2);
    });

    it('un plan sin configuracion rechaza con error claro en vez de quedar pendiente', async () => {
      await expect(service.generateBlocksForPlan('custom')).rejects.toThrow(
        'No hay configuración de bloques para el plan "custom"'
      );
    });

    it('infinity y reto333 no consumen Math.random', async () => {
      const spy = mockRandom(0.1);
      await service.generateBlocksForPlan('infinity');
      await service.generateBlocksForPlan('reto333');
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
