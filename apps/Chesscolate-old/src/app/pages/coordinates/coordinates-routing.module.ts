import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { CoordinatesPage } from './coordinates.page';

const routes: Routes = [
  {
    path: 'training',
    component: CoordinatesPage
  },
  {
    path: '**',
    redirectTo: 'training',
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CoordinatesPageRoutingModule { }
