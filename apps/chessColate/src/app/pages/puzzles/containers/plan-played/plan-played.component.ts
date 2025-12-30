import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { ModalController, IonContent, IonFooter, IonToolbar } from '@ionic/angular/standalone';

import { TranslocoPipe } from '@jsverse/transloco';

import { Plan, Block, Puzzle, UserPuzzle } from '@cpark/models';
import { PlanFacadeService } from '@cpark/state';

import { AppService } from '@services/app.service';
import { PlanService } from '@services/plan.service';
import { ProfileService } from '@services/profile.service';
import { PlansElosService } from '@services/plans-elos.service';
import { BlockService } from '@services/block.service';

import { BoardPuzzleSolutionComponent } from '@chesspark/board';
import { FenBoardComponent } from '@chesspark/board';
import { PlanChartComponent } from '@pages/puzzles/components/plan-chart/plan-chart.component';

@Component({
  selector: 'app-plan-played',
  standalone: true,
  imports: [CommonModule, TranslocoPipe, FenBoardComponent, PlanChartComponent, IonContent, IonFooter, IonToolbar],
  templateUrl: './plan-played.component.html',
  styleUrl: './plan-played.component.scss',
})
export class PlanPlayedComponent implements OnInit {
  private planFacade = inject(PlanFacadeService);
  private router = inject(Router);
  private modalController = inject(ModalController);
  public appService = inject(AppService);
  private planService = inject(PlanService);
  private profileService = inject(ProfileService);
  private plansElosService = inject(PlansElosService);
  private blockService = inject(BlockService);

  plan: Plan | null = null;
  puzzlesPerPage = 4;
  showMoreButtons: { [blockIndex: number]: boolean } = {};
  userPuzzlesToShowInBoards: { [blockIndex: number]: UserPuzzle[] } = {};
  eloTotal: number = 0;
  isLoadingToPlay = false;

  ngOnInit() {
    this.planFacade.getPlan$().subscribe((plan: Plan | null) => {
      if (!plan) {
        this.router.navigate(['/home']);
        return;
      }
      this.plan = plan;
      this.getTotalElo();

      this.plan.blocks.forEach((block, blockIndex) => {
        // Inicialmente carga 4 tableros por bloque
        this.userPuzzlesToShowInBoards[blockIndex] = block.puzzlesPlayed.slice(0, this.puzzlesPerPage);
        this.showMoreButtons[blockIndex] = block.puzzlesPlayed.length > this.puzzlesPerPage;
      });
    });
  }

  async getTotalElo() {
    if (!this.plan) {
      return;
    }

    if (this.plan.planType === 'custom' && this.plan.uidCustomPlan) {
      const planElos = await this.plansElosService.getOnePlanElo(this.plan.uidCustomPlan);
      this.eloTotal = planElos?.total || 0;
    } else {
      this.eloTotal = this.profileService.getEloTotalByPlanType(this.plan.planType);
    }
  }

  loadMorePuzzles(blockIndex: number) {
    if (!this.plan) {
      return;
    }

    const block = this.plan.blocks[blockIndex];
    const currentCount = this.userPuzzlesToShowInBoards[blockIndex].length;
    // Añadir más tableros
    const nextPuzzles = block.puzzlesPlayed.slice(currentCount, currentCount + this.puzzlesPerPage);
    this.userPuzzlesToShowInBoards[blockIndex] = [
      ...this.userPuzzlesToShowInBoards[blockIndex],
      ...nextPuzzles
    ];

    // Ocultar el botón si ya se han cargado todos los tableros
    if (this.userPuzzlesToShowInBoards[blockIndex].length >= block.puzzlesPlayed.length) {
      this.showMoreButtons[blockIndex] = false;
    }
  }

  async onPuzzleShowSolution(puzzle: Puzzle) {
    const modal = await this.modalController.create({
      component: BoardPuzzleSolutionComponent,
      componentProps: {
        puzzle
      }
    });
    await modal.present();
  }

  async onPlayPlan() {
    if (!this.plan) {
      return;
    }

    this.isLoadingToPlay = true;
    try {
      if (this.plan.planType === 'custom') {
        // TODO: Implementar makeCustomPlanForPlay si es necesario
        // const planReadyToPlay = await this.planService.makeCustomPlanForPlay(this.plan);
        // this.planFacade.setPlan(planReadyToPlay);
      } else {
        const blocks: Block[] = await this.blockService.generateBlocksForPlan(this.plan.planType);
        // se recorre cada bloque para generar los puzzles
        for (const block of blocks) {
          block.puzzles = await this.blockService.getPuzzlesForBlock(block);
        }
        await this.planService.newPlan(blocks, this.plan.planType);
      }
      this.router.navigate(['/puzzles/training']);
    } finally {
      this.isLoadingToPlay = false;
    }
  }
}

