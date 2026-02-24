import { Routes } from '@angular/router';
import { CustomPlansGuard } from './guards/custom-plans.guard';
import { AuthGuard } from './guards/auth.guard';
import { PublicPlansGuard } from './guards/public-plans.guard';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () =>
      import('./pages/home/home.page').then((m) => m.HomePage),
  },
  // {
  //   path: 'puzzles',
  //   loadComponent: () => import('./pages/puzzles/puzzles.page').then(m => m.PuzzlesPage)
  // },
  {
    path: 'puzzles/training',
    loadComponent: () => import('./pages/puzzles/containers/training/training.component').then(m => m.TrainingComponent),
  },
  {
    path: 'puzzles/plan-played',
    loadComponent: () => import('./pages/puzzles/containers/plan-played/plan-played.component').then(m => m.PlanPlayedComponent),
  },
  {
    path: 'puzzles/custom-plans',
    loadComponent: () => import('./pages/puzzles/containers/custom-plans-list/custom-plans-list.component').then(m => m.CustomPlansListComponent),
    canActivate: [CustomPlansGuard],
  },
  {
    path: 'puzzles/custom-plans/create',
    loadComponent: () => import('./pages/puzzles/containers/custom-plan-form/custom-plan-form.component').then(m => m.CustomPlanFormComponent),
    canActivate: [AuthGuard],
  },
  {
    path: 'puzzles/custom-plans/edit/:uid',
    loadComponent: () => import('./pages/puzzles/containers/custom-plan-form/custom-plan-form.component').then(m => m.CustomPlanFormComponent),
    canActivate: [AuthGuard],
  },
  {
    path: 'puzzles/public-plans',
    loadComponent: () => import('./pages/puzzles/containers/public-plans/public-plans.component').then(m => m.PublicPlansComponent),
    canActivate: [PublicPlansGuard],
  },
  {
    path: 'coordinates',
    loadComponent: () => import('./pages/coordinates/coordinates.page').then(m => m.CoordinatesPage),
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
];
