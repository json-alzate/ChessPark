import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { IonContent, IonFab, IonFabButton, IonIcon } from '@ionic/angular/standalone';

import { TranslocoPipe } from '@jsverse/transloco';

import { Plan } from '@cpark/models';

import { CustomPlansService } from '@services/custom-plans.service';
import { PlanService } from '@services/plan.service';
import { ProfileService } from '@services/profile.service';
import { PlanFacadeService } from '@cpark/state';

import { NavbarComponent } from '@shared/components/navbar/navbar.component';

import { addIcons } from 'ionicons';
import { add, playOutline, createOutline } from 'ionicons/icons';

@Component({
  selector: 'app-custom-plans-list',
  standalone: true,
  imports: [
    CommonModule,
    TranslocoPipe,
    IonContent,
    IonFab,
    IonFabButton,
    IonIcon,
    NavbarComponent,
  ],
  templateUrl: './custom-plans-list.component.html',
  styleUrl: './custom-plans-list.component.scss',
})
export class CustomPlansListComponent implements OnInit {
  private customPlansService = inject(CustomPlansService);
  private planService = inject(PlanService);
  private profileService = inject(ProfileService);
  private planFacade = inject(PlanFacadeService);
  private router = inject(Router);

  plans$ = this.customPlansService.getMyPlans$();

  constructor() {
    addIcons({ add, playOutline, createOutline });
  }

  ngOnInit(): void {
    // El guard se encarga de cargar los planes; esta vista usa el estado NgRx
  }

  goToCreate(): void {
    this.router.navigate(['/puzzles/custom-plans/create']);
  }

  goToEdit(plan: Plan): void {
    this.router.navigate(['/puzzles/custom-plans/edit', plan.uid]);
  }

  async play(plan: Plan): Promise<void> {
    const totalBlockTime = plan.blocks.reduce(
      (sum, b) => sum + (b.time > 0 ? b.time : 0),
      0
    );
    const profile = this.profileService.getProfile;
    let eloToStart = 1500;
    if (profile?.elos) {
      if (totalBlockTime <= 3000 && typeof profile.elos.plan5Total === 'number')
        eloToStart = profile.elos.plan5Total;
      else if (
        totalBlockTime > 3000 &&
        totalBlockTime <= 6000 &&
        typeof profile.elos.plan10Total === 'number'
      )
        eloToStart = profile.elos.plan10Total;
      else if (
        totalBlockTime > 6000 &&
        totalBlockTime <= 12000 &&
        typeof profile.elos.plan20Total === 'number'
      )
        eloToStart = profile.elos.plan20Total;
      else if (
        totalBlockTime > 12000 &&
        typeof profile.elos.plan30Total === 'number'
      )
        eloToStart = profile.elos.plan30Total;
    }
    const planToPlay = await this.planService.makeCustomPlanForPlay(
      plan,
      eloToStart
    );
    this.planFacade.setPlan(planToPlay);
    this.router.navigate(['/puzzles/training']);
  }

  formatDate(createdAt: number): string {
    if (!createdAt) return '';
    return new Date(createdAt).toLocaleDateString();
  }
}
