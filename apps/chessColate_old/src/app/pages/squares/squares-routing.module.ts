import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { SquaresPage } from './squares.page';

const routes: Routes = [
  {
    path: 'training',
    component: SquaresPage
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
export class SquaresPageRoutingModule { }
