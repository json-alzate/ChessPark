import { Routes } from '@angular/router';

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
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
];
