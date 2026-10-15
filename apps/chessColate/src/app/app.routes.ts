import { Routes } from '@angular/router';
import { CustomPlansGuard } from './features/training/guards/custom-plans.guard';
import { AuthGuard } from './core/guards/auth.guard';
import { PublicPlansGuard } from './features/training/guards/public-plans.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'home',
    loadComponent: () =>
      import('./features/home/pages/home.page').then((m) => m.HomePage),
  },
  {
    path: 'donation',
    loadComponent: () =>
      import('./features/donation/pages/donation.page').then((m) => m.DonationPage),
  },
  // {
  //   path: 'puzzles',
  //   loadComponent: () => import('./pages/puzzles/puzzles.page').then(m => m.PuzzlesPage)
  // },
  {
    path: 'puzzles/training',
    loadComponent: () =>
      import('./features/training/pages/training/training.page').then(
        (m) => m.TrainingPage
      ),
  },
  {
    path: 'puzzles/plan-played',
    loadComponent: () =>
      import(
        './features/training/pages/plan-played/plan-played.page'
      ).then((m) => m.PlanPlayedPage),
  },
  {
    path: 'puzzles/plans-history',
    loadComponent: () =>
      import(
        './features/training/pages/plans-history/plans-history.page'
      ).then((m) => m.PlansHistoryPage),
  },
  {
    path: 'puzzles/custom-plans',
    loadComponent: () =>
      import(
        './features/training/pages/custom-plans-list/custom-plans-list.page'
      ).then((m) => m.CustomPlansListPage),
    canActivate: [CustomPlansGuard],
  },
  {
    path: 'puzzles/custom-plans/create',
    loadComponent: () =>
      import(
        './features/training/pages/custom-plan-form/custom-plan-form.page'
      ).then((m) => m.CustomPlanFormPage),
    canActivate: [AuthGuard],
  },
  {
    path: 'puzzles/custom-plans/edit/:uid',
    loadComponent: () =>
      import(
        './features/training/pages/custom-plan-form/custom-plan-form.page'
      ).then((m) => m.CustomPlanFormPage),
    canActivate: [AuthGuard],
  },
  {
    path: 'puzzles/public-plans',
    loadComponent: () =>
      import(
        './features/training/pages/public-plans/public-plans.page'
      ).then((m) => m.PublicPlansPage),
    canActivate: [PublicPlansGuard],
  },
  {
    path: 'games',
    loadComponent: () =>
      import('./features/games/pages/games/games.page').then((m) => m.GamesPage),
  },
  {
    // PGN que trae el usuario: no tiene id de colección
    path: 'games/pgn',
    loadComponent: () =>
      import('./features/games/pages/player/player.page').then((m) => m.GamesPlayerPage),
  },
  {
    path: 'games/viewer',
    loadComponent: () =>
      import('./features/games/pages/viewer/viewer.page').then((m) => m.GamesViewerPage),
  },
  {
    path: 'games/:id',
    loadComponent: () =>
      import('./features/games/pages/player/player.page').then((m) => m.GamesPlayerPage),
  },
  {
    path: 'analytics',
    loadComponent: () =>
      import('./features/game-analytics/pages/analytics.page').then((m) => m.AnalyticsPage),
  },
  {
    path: 'streak',
    loadComponent: () =>
      import('./features/streak/pages/streak.page').then((m) => m.StreakPage),
  },
  {
    path: 'woodpecker',
    loadComponent: () =>
      import('./features/woodpecker/pages/woodpecker/woodpecker.page').then(
        (m) => m.WoodpeckerPage
      ),
  },
  {
    path: 'woodpecker/play',
    loadComponent: () =>
      import('./features/woodpecker/pages/woodpecker-play/woodpecker-play.page').then(
        (m) => m.WoodpeckerPlayPage
      ),
  },
  {
    path: 'chess-runner',
    loadComponent: () =>
      import('./features/chess-runner/pages/chess-runner/chess-runner.page').then(
        (m) => m.ChessRunnerPage
      ),
  },
  {
    path: 'coordinates',
    loadComponent: () =>
      import('./features/coordinates/pages/coordinates.page').then(
        (m) => m.CoordinatesPage
      ),
  },
  {
    path: 'knight-tour',
    loadComponent: () =>
      import('./features/knight-tour/pages/knight-tour.page').then(
        (m) => m.KnightTourPage
      ),
  },
  {
    path: 'chess960',
    loadComponent: () =>
      import('./features/chess960/pages/chess960.page').then((m) => m.Chess960Page),
  },
  {
    path: 'privacy',
    loadComponent: () =>
      import('./features/privacy/pages/privacy.page').then((m) => m.PrivacyPage),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./features/settings/pages/settings/settings.page').then((m) => m.SettingsPage),
  },
  {
    path: 'settings/storage',
    loadComponent: () =>
      import('./features/settings/pages/storage/storage.page').then((m) => m.StoragePage),
  },
  {
    path: 'settings/credits',
    loadComponent: () =>
      import('./features/settings/pages/credits/credits.page').then((m) => m.CreditsPage),
  },
  {
    path: 'reminders',
    loadComponent: () =>
      import('./features/reminders/pages/reminders.page').then((m) => m.RemindersPage),
  },
  {
    path: '**',
    redirectTo: 'home',
  },
];
