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
      import('./features/training/pages/training.component').then(
        (m) => m.TrainingComponent
      ),
  },
  {
    path: 'puzzles/plan-played',
    loadComponent: () =>
      import(
        './features/training/pages/plan-played.component'
      ).then((m) => m.PlanPlayedComponent),
  },
  {
    path: 'puzzles/plans-history',
    loadComponent: () =>
      import(
        './features/training/pages/plans-history.component'
      ).then((m) => m.PlansHistoryComponent),
  },
  {
    path: 'puzzles/custom-plans',
    loadComponent: () =>
      import(
        './features/training/pages/custom-plans-list.component'
      ).then((m) => m.CustomPlansListComponent),
    canActivate: [CustomPlansGuard],
  },
  {
    path: 'puzzles/custom-plans/create',
    loadComponent: () =>
      import(
        './features/training/pages/custom-plan-form.component'
      ).then((m) => m.CustomPlanFormComponent),
    canActivate: [AuthGuard],
  },
  {
    path: 'puzzles/custom-plans/edit/:uid',
    loadComponent: () =>
      import(
        './features/training/pages/custom-plan-form.component'
      ).then((m) => m.CustomPlanFormComponent),
    canActivate: [AuthGuard],
  },
  {
    path: 'puzzles/public-plans',
    loadComponent: () =>
      import(
        './features/training/pages/public-plans.component'
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
