import { Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IonRippleEffect, LoadingController } from '@ionic/angular/standalone';

// services
import { BlockService } from '@services/block.service';
import { PlanService } from '@services/plan.service';

import { addIcons } from 'ionicons';
import { timerOutline} from 'ionicons/icons';
import { Block, Plan, PlanTypes } from '@cpark/models';

@Component({
  selector: 'app-training-menu',
  imports: [CommonModule, IonRippleEffect],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './training-menu.component.html',
  styleUrl: './training-menu.component.scss',
})
export class TrainingMenuComponent {
  private blockService = inject(BlockService);
  private planService = inject(PlanService);

  constructor(private loadingController: LoadingController) {
    addIcons({ timerOutline });
  }

  async createPlan(planType: PlanTypes) {
    this.showLoading();
    const blocks: Block[] = await this.blockService.generateBlocksForPlan(planType);

    // se recorre cada bloque para generar los puzzles
    for (const block of blocks) {
      block.puzzles = await this.blockService.getPuzzlesForBlock(block);
    }

    const newPlan: Plan = await this.planService.newPlan(blocks, planType);
    this.hideLoading();
  }

  showLoading() {
    console.log('showLoading');
    this.loadingController.create({
      message: 'Creating plan...',
    });
  }

  hideLoading() {
    console.log('hideLoading');
    this.loadingController.dismiss();
  }
}
