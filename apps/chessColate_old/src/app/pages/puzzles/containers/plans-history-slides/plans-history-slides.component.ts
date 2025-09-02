import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';

import { Platform } from '@ionic/angular';

import { Plan } from '@models/plan.model';

import { PlanService } from '@services/plan.service';

@Component({
  selector: 'app-plans-history-slides',
  templateUrl: './plans-history-slides.component.html',
  styleUrls: ['./plans-history-slides.component.scss'],
})
export class PlansHistorySlidesComponent implements OnInit {

  @Input() plans: Plan[] = [];
  @Input() countAllPlans: number;
  @Output() slideClick: EventEmitter<boolean> = new EventEmitter();



  breakpoints;

  constructor(
    private planService: PlanService,
    private router: Router,
    private platform: Platform
  ) {

    if (!this.platform.is('android') && !this.platform.is('ios')) {
      this.breakpoints = {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        0: { slidesPerView: 1, spaceBetween: 0 },
        // eslint-disable-next-line @typescript-eslint/naming-convention
        640: { slidesPerView: 2, spaceBetween: 0 },
        // eslint-disable-next-line @typescript-eslint/naming-convention
        768: { slidesPerView: 3, spaceBetween: 0 },
        // eslint-disable-next-line @typescript-eslint/naming-convention
        1024: { slidesPerView: 3, spaceBetween: 0 },
        // eslint-disable-next-line @typescript-eslint/naming-convention
        1224: { slidesPerView: 5, spaceBetween: 0 },
        // eslint-disable-next-line @typescript-eslint/naming-convention
        1440: { slidesPerView: 5, spaceBetween: 0 }
      };
    }



  }

  ngOnInit() { }

  goToPlanDetails(plan) {
    this.planService.setPlanAction(plan);
    this.router.navigate(['/puzzles/plan-played']);
  }

  goToHistoryPage() {
    this.router.navigate(['/puzzles/plans-history']);
  }

}
