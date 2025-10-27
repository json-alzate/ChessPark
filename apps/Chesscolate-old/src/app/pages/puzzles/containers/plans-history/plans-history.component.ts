import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { Observable } from 'rxjs';

import { Plan, Block, PlanTypes } from '@models/plan.model';

import { PlanService } from '@services/plan.service';
@Component({
  selector: 'app-plans-history',
  templateUrl: './plans-history.component.html',
  styleUrls: ['./plans-history.component.scss'],
})
export class PlansHistoryComponent implements OnInit {

  plansHistory$: Observable<Plan[]>;
  allPlans: Plan[];
  plans: Plan[];
  index = 0;
  constructor(
    private planService: PlanService,
    private router: Router
  ) {
    this.planService.getPlansHistoryState().subscribe((plans) => {
      this.allPlans = plans;
      this.plans = this.allPlans.slice(this.index, this.index + 20);
      this.index += 20;
    });

  }

  ngOnInit() { }

  onIonInfinite(infiniteScroll) {

    setTimeout(() => {
      this.plans = [...this.plans, ...this.allPlans.slice(this.index, this.index + 5)];
      this.index += 5;
      infiniteScroll.target.complete();
    }, 500);
  }

  goToPlanDetails(plan) {
    this.planService.setPlanAction(plan);
    this.router.navigate(['/puzzles/plan-played']);
  }

}
