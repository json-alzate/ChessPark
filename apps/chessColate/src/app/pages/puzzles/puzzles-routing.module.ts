import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { PuzzlesPage } from './puzzles.page';
import { TrainingComponent } from './containers/training/training.component';
import { TrainingMenuComponent } from './containers/training-menu/training-menu.component';
import { CustomTrainingComponent } from './containers/custom-training/custom-training.component';
import { PlanPlayedComponent } from './containers/plan-played/plan-played.component';
import { PlansHistoryComponent } from './containers/plans-history/plans-history.component';

const routes: Routes = [
  {
    path: 'training-menu',
    component: TrainingMenuComponent
  },
  {
    path: 'training',
    component: TrainingComponent
  },
  {
    path: 'custom-training',
    component: CustomTrainingComponent
  },
  {
    path: 'plan-played',
    component: PlanPlayedComponent
  },
  {
    path: 'plans-history',
    component: PlansHistoryComponent
  },
  {
    path: '**',
    redirectTo: 'training-menu',
    pathMatch: 'full'
  }

];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PuzzlesPageRoutingModule { }
