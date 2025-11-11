import { Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IonRippleEffect, LoadingController } from '@ionic/angular/standalone';

// services
import { BlockService } from '@services/block.service';
import { PlanService } from '@services/plan.service';

import { addIcons } from 'ionicons';
import { timerOutline} from 'ionicons/icons';
import { Block, Plan, PlanTypes } from '@cpark/models';
import { Router } from '@angular/router';



import { BoardComponent } from '@chesspark/board';

@Component({
  selector: 'app-training',
  imports: [CommonModule, IonRippleEffect, BoardComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './training.component.html',
  styleUrl: './training.component.scss',
})
export class TrainingComponent {
  private blockService = inject(BlockService);
  private planService = inject(PlanService);
  private router = inject(Router);
  constructor(private loadingController: LoadingController) {
    addIcons({ timerOutline });
  }


}
