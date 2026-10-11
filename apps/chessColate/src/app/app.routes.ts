import { Routes } from '@angular/router';
import { CustomPlansGuard } from './guards/custom-plans.guard';
import { AuthGuard } from './guards/auth.guard';
import { PublicPlansGuard } from './guards/public-plans.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'home',
    loadComponent: () =>
      import('./pages/home/home.page').then((m) => m.HomePage),
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
      import('./pages/puzzles/containers/training/training.component').then(
        (m) => m.TrainingComponent
      ),
  },
  {
    path: 'puzzles/plan-played',
    loadComponent: () =>
      import(
        './pages/puzzles/containers/plan-played/plan-played.component'
      ).then((m) => m.PlanPlayedComponent),
  },
  {
    path: 'puzzles/plans-history',
    loadComponent: () =>
      import(
        './pages/puzzles/containers/plans-history/plans-history.component'
      ).then((m) => m.PlansHistoryComponent),
  },
  {
    path: 'puzzles/custom-plans',
    loadComponent: () =>
      import(
        './pages/puzzles/containers/custom-plans-list/custom-plans-list.component'
      ).then((m) => m.CustomPlansListComponent),
    canActivate: [CustomPlansGuard],
  },
  {
    path: 'puzzles/custom-plans/create',
    loadComponent: () =>
      import(
        './pages/puzzles/containers/custom-plan-form/custom-plan-form.component'
      ).then((m) => m.CustomPlanFormComponent),
    canActivate: [AuthGuard],
  },
  {
    path: 'puzzles/custom-plans/edit/:uid',
    loadComponent: () =>
      import(
        './pages/puzzles/containers/custom-plan-form/custom-plan-form.component'
      ).then((m) => m.CustomPlanFormComponent),
    canActivate: [AuthGuard],
  },
  {
    path: 'puzzles/public-plans',
    loadComponent: () =>
      import(
        './pages/puzzles/containers/public-plans/public-plans.component'
      ).then((m) => m.PublicPlansComponent),
    canActivate: [PublicPlansGuard],
  },
  {
    path: 'games',
    loadComponent: () =>
      import('./features/games/pages/games.page').then((m) => m.GamesPage),
  },
  {
    // PGN que trae el usuario: no tiene id de colección
    path: 'games/pgn',
    loadComponent: () =>
      import('./features/games/pages/player.page').then((m) => m.GamesPlayerPage),
  },
  {
    path: 'games/viewer',
    loadComponent: () =>
      import('./features/games/pages/viewer.page').then((m) => m.GamesViewerPage),
  },
  {
    path: 'games/:id',
    loadComponent: () =>
      import('./features/games/pages/player.page').then((m) => m.GamesPlayerPage),
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
      import('./features/settings/pages/settings.page').then((m) => m.SettingsPage),
  },
  {
    path: 'settings/storage',
    loadComponent: () =>
      import('./features/settings/pages/storage.page').then((m) => m.StoragePage),
  },
  {
    path: 'reminders',
    loadComponent: () =>
      import('./features/reminders/pages/reminders.page').then((m) => m.RemindersPage),
  },
];
