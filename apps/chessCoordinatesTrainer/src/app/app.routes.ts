import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'coordinates',
    loadComponent: () => import('./pages/coordinates/coordinates.page').then((m) => m.CoordinatesPage),
  },
  {
    path: '',
    redirectTo: 'coordinates',
    pathMatch: 'full',
  },
];

