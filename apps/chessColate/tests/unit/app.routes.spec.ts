// Las rutas cargan (perezosamente) todas las pantallas de la app. Aquí solo interesa que cada
// ruta resuelva a su clase de componente, así que se sustituyen las librerías nativas o
// pesadas que Jest no puede cargar (tableros, Stockfish) por módulos vacíos.
jest.mock('@chesspark/board', () => ({}));
jest.mock('@chesspark/stockfish-wasm', () => ({}));

import { Route } from '@angular/router';

import { routes } from '@app/app.routes';
import { AuthGuard } from '@core/guards/auth.guard';
import { CustomPlansGuard } from '@features/training/guards/custom-plans.guard';
import { PublicPlansGuard } from '@features/training/guards/public-plans.guard';

/** Cada ruta con carga perezosa: su ruta y el nombre de la clase que debe entregar. */
const PANTALLAS: ReadonlyArray<readonly [path: string, clase: string]> = [
  ['home', 'HomePage'],
  ['donation', 'DonationPage'],
  ['puzzles/training', 'TrainingPage'],
  ['puzzles/plan-played', 'PlanPlayedPage'],
  ['puzzles/plans-history', 'PlansHistoryPage'],
  ['puzzles/custom-plans', 'CustomPlansListPage'],
  ['puzzles/custom-plans/create', 'CustomPlanFormPage'],
  ['puzzles/custom-plans/edit/:uid', 'CustomPlanFormPage'],
  ['puzzles/public-plans', 'PublicPlansPage'],
  ['games', 'GamesPage'],
  ['games/pgn', 'GamesPlayerPage'],
  ['games/viewer', 'GamesViewerPage'],
  ['games/:id', 'GamesPlayerPage'],
  ['analytics', 'AnalyticsPage'],
  ['streak', 'StreakPage'],
  ['woodpecker', 'WoodpeckerPage'],
  ['woodpecker/play', 'WoodpeckerPlayPage'],
  ['chess-runner', 'ChessRunnerPage'],
  ['coordinates', 'CoordinatesPage'],
  ['knight-tour', 'KnightTourPage'],
  ['chess960', 'Chess960Page'],
  ['privacy', 'PrivacyPage'],
  ['settings', 'SettingsPage'],
  ['settings/storage', 'StoragePage'],
  ['settings/credits', 'CreditsPage'],
  ['reminders', 'RemindersPage'],
];

/** Rutas protegidas y con qué guards. */
const GUARDS: ReadonlyArray<readonly [path: string, guards: unknown[]]> = [
  ['puzzles/custom-plans', [CustomPlansGuard]],
  ['puzzles/custom-plans/create', [AuthGuard]],
  ['puzzles/custom-plans/edit/:uid', [AuthGuard]],
  ['puzzles/public-plans', [PublicPlansGuard]],
];

const rutaDe = (path: string): Route | undefined => routes.find((r) => r.path === path);

/** La primera ruta que casaría con una URL, como hace el router con rutas simples. */
function primeraQueCasa(url: string): string | undefined {
  const segmentos = url.split('/');
  return routes.find((ruta) => {
    const patron = (ruta.path ?? '').split('/');
    return (
      patron.length === segmentos.length &&
      patron.every((parte, i) => parte.startsWith(':') || parte === segmentos[i])
    );
  })?.path;
}

describe('app.routes', () => {
  it('la raíz redirige a /home solo cuando la URL es exactamente vacía', () => {
    const raiz = rutaDe('');
    expect(raiz?.redirectTo).toBe('home');
    expect(raiz?.pathMatch).toBe('full');
  });

  it('no repite ninguna ruta', () => {
    const paths = routes.map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('declara exactamente las pantallas esperadas (nada más, nada menos)', () => {
    const conComponente = routes.filter((r) => r.loadComponent).map((r) => r.path);
    expect(conComponente.sort()).toEqual(PANTALLAS.map(([path]) => path).sort());
  });

  it('toda ruta tiene destino: o redirige o carga un componente', () => {
    for (const ruta of routes) {
      expect(Boolean(ruta.redirectTo) !== Boolean(ruta.loadComponent)).toBe(true);
    }
  });

  describe.each(PANTALLAS)('/%s', (path, clase) => {
    it(`carga el componente ${clase}`, async () => {
      const ruta = rutaDe(path);
      expect(ruta?.loadComponent).toBeDefined();
      const componente = await (ruta?.loadComponent as () => Promise<unknown>)();
      expect(typeof componente).toBe('function');
      expect((componente as { name: string }).name).toBe(clase);
    });
  });

  describe('protección de rutas', () => {
    it.each(GUARDS)('/%s exige %j', (path, guards) => {
      expect(rutaDe(path)?.canActivate).toEqual(guards);
    });

    it('el resto de rutas son públicas', () => {
      const protegidas = GUARDS.map(([path]) => path);
      for (const ruta of routes) {
        if (!protegidas.includes(ruta.path as string)) {
          expect(ruta.canActivate).toBeUndefined();
        }
      }
    });

    it('los guards son inyectables con un método canActivate', () => {
      for (const guard of [AuthGuard, CustomPlansGuard, PublicPlansGuard]) {
        expect(typeof guard.prototype.canActivate).toBe('function');
      }
    });
  });

  describe('orden de las rutas con parámetros', () => {
    it.each([
      ['games', 'games'],
      ['games/pgn', 'games/pgn'],
      ['games/viewer', 'games/viewer'],
      ['games/petrosian', 'games/:id'],
      ['puzzles/custom-plans/create', 'puzzles/custom-plans/create'],
      ['puzzles/custom-plans/edit/abc123', 'puzzles/custom-plans/edit/:uid'],
    ])('la URL /%s la atiende %s', (url, esperada) => {
      // si "games/:id" fuera antes que "games/viewer", el visor se abriría como una colección
      expect(primeraQueCasa(url)).toBe(esperada);
    });
  });
});
