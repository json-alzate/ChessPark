import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { ModalController, IonContent, IonFooter, IonToolbar, IonIcon } from '@ionic/angular/standalone';

import { TranslocoPipe } from '@jsverse/transloco';

import { Plan, Puzzle, UserPuzzle } from '@cpark/models';
import { PlanFacadeService, PublicPlansFacadeService } from '@cpark/state';

import { AppService } from '@services/app.service';
import { ProfileService } from '@services/profile.service';
import { PlansElosService } from '@services/plans-elos.service';
import { FirestoreService } from '@services/firestore.service';

import { BoardPuzzleSolutionComponent } from '@chesspark/board';
import { FenBoardComponent } from '@chesspark/board';
import { PlanChartComponent } from '@pages/puzzles/components/plan-chart/plan-chart.component';

import { addIcons } from 'ionicons';
import { heartOutline, heart } from 'ionicons/icons';

@Component({
  selector: 'app-plan-played',
  standalone: true,
  imports: [CommonModule, TranslocoPipe, FenBoardComponent, PlanChartComponent, IonContent, IonFooter, IonToolbar, IonIcon],
  templateUrl: './plan-played.component.html',
  styleUrl: './plan-played.component.scss',
})
export class PlanPlayedComponent implements OnInit, OnDestroy {
  private planFacade = inject(PlanFacadeService);
  private router = inject(Router);
  private modalController = inject(ModalController);
  public appService = inject(AppService);
  private profileService = inject(ProfileService);
  private plansElosService = inject(PlansElosService);
  private publicPlansFacade = inject(PublicPlansFacadeService);
  private firestoreService = inject(FirestoreService);

  plan: Plan | null = null;
  puzzlesPerPage = 4;
  showMoreButtons: { [blockIndex: number]: boolean } = {};
  userPuzzlesToShowInBoards: { [blockIndex: number]: UserPuzzle[] } = {};
  eloTotal: number = 0;
  isLiked: boolean = false;
  isLoadingLike: boolean = false;

  constructor() {
    addIcons({ heartOutline, heart });
  }

  ngOnInit() {
    this.planFacade.getPlan$().subscribe(async (plan: Plan | null) => {
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

      // Si el plan es público, verificar si el usuario le ha dado me gusta
      if (this.isPublicPlan && this.canLike) {
        await this.checkLikeStatus();
      }
    });
  }

  get isPublicPlan(): boolean {
    return this.plan?.isPublic === true;
  }

  get canLike(): boolean {
    // Solo mostrar botón si el plan es público y el usuario NO es el creador
    const profile = this.profileService.getProfile;
    return this.isPublicPlan && this.plan?.uidUser !== profile?.uid;
  }

  async checkLikeStatus(): Promise<void> {
    if (!this.plan || !this.profileService.getProfile?.uid) return;
    
    try {
      const interaction = await this.firestoreService.getPlanInteraction(
        this.profileService.getProfile.uid,
        this.plan.uid
      );
      this.isLiked = interaction?.liked ?? false;
    } catch (error) {
      console.error('Error checking like status', error);
    }
  }

  async onToggleLike(): Promise<void> {
    if (!this.plan || !this.canLike || this.isLoadingLike) return;
    
    const profile = this.profileService.getProfile;
    if (!profile?.uid) return;

    this.isLoadingLike = true;
    const newLikedState = !this.isLiked;

    try {
      this.publicPlansFacade.togglePlanLike(profile.uid, this.plan.uid, newLikedState);
      this.isLiked = newLikedState;
    } catch (error) {
      console.error('Error toggling like', error);
    } finally {
      this.isLoadingLike = false;
    }
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
    const themesTranslated = puzzle.themes.map(theme =>
      this.appService.getNameThemePuzzleByValue(theme)
    );

    const modal = await this.modalController.create({
      component: BoardPuzzleSolutionComponent,
      componentProps: {
        puzzle,
        themesTranslated
      }
    });
    await modal.present();
  }

  onPlayPlan() {
    // Limpiar el estado del plan antes de navegar al inicio
    this.planFacade.clearPlan();
    this.router.navigate(['/home']);
  }

  ngOnDestroy() {
    // Limpiar el plan al salir de la pantalla de plan-played
    this.planFacade.clearPlan();
  }
}

