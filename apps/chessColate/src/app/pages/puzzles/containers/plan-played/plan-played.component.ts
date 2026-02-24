import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { ModalController, IonContent, IonIcon } from '@ionic/angular/standalone';

import { TranslocoPipe } from '@jsverse/transloco';

import { Plan, Puzzle, UserPuzzle, Block } from '@cpark/models';
import { PlanFacadeService, PublicPlansFacadeService } from '@cpark/state';

import { AppService } from '@services/app.service';
import { ProfileService } from '@services/profile.service';
import { PlansElosService } from '@services/plans-elos.service';
import { FirestoreService } from '@services/firestore.service';
import { BlockService } from '@services/block.service';
import { PlanService } from '@services/plan.service';
import { LoadingController } from '@ionic/angular/standalone';

import { BoardPuzzleSolutionComponent } from '@chesspark/board';
import { FenBoardComponent } from '@chesspark/board';
import { PlanChartComponent } from '@pages/puzzles/components/plan-chart/plan-chart.component';
import { LoginComponent } from '@shared/components/login/login.component';
import { NavbarComponent } from '@shared/components/navbar/navbar.component';
import { TrainingMenuComponent } from '@pages/home/components/training-menu.component';
import { ConfettiService } from '@chesspark/common-utils';

import { addIcons } from 'ionicons';
import { heartOutline, heart } from 'ionicons/icons';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-plan-played',
  standalone: true,
  imports: [CommonModule, TranslocoPipe, FenBoardComponent, PlanChartComponent, IonContent, IonIcon, NavbarComponent, TrainingMenuComponent],
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
  private blockService = inject(BlockService);
  private planService = inject(PlanService);
  private loadingController = inject(LoadingController);
  private confettiService = inject(ConfettiService);

  plan: Plan | null = null;
  puzzlesPerPage = 4;
  showMoreButtons: { [blockIndex: number]: boolean } = {};
  userPuzzlesToShowInBoards: { [blockIndex: number]: UserPuzzle[] } = {};
  eloTotal: number = 0;
  isLiked: boolean = false;
  isLoadingLike: boolean = false;
  isLoadingToPlay: boolean = false;

  isAuthenticated: boolean = false;
  isLoadingPlan: boolean = false;
  private hasHadPlan: boolean = false; // Flag para saber si alguna vez tuvimos un plan
  private destroy$ = new Subject<void>();

  constructor() {
    addIcons({ heartOutline, heart });
  }

  ngOnInit() {
    // Suscribirse al estado de autenticación
    this.profileService.profile$
      .pipe(takeUntil(this.destroy$))
      .subscribe(profile => {
        this.isAuthenticated = !!profile;
      });

    // Suscribirse al estado de carga del plan
    this.planFacade.getLoadingPlan$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(loading => {
        this.isLoadingPlan = loading;
        // Si se está cargando un nuevo plan, limpiar el plan actual para mostrar skeletons
        if (loading) {
          this.plan = null;
          this.userPuzzlesToShowInBoards = {};
          this.showMoreButtons = {};
        }
      });

    // Suscribirse al plan
    this.planFacade.getPlan$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(async (plan: Plan | null) => {
        // Si hay un plan, solo procesarlo si está terminado (isFinished === true)
        // Esto evita que plan-played reaccione a planes nuevos que se están creando
        if (plan) {
          // Solo procesar planes terminados en plan-played
          if (plan.isFinished === true) {
            this.hasHadPlan = true;
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
          }
          // Si el plan no está terminado, ignorarlo (es un plan nuevo que se está creando)
        } else if (!plan && !this.isLoadingPlan && !this.hasHadPlan) {
          // Solo navegar a home si nunca tuvimos un plan y no se está cargando uno
          // Esto evita navegar cuando se limpia el plan para cargar uno nuevo
          this.router.navigate(['/home']);
          return;
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
      
      // Verificar si se superó el máximo histórico inicial (antes de empezar este juego)
      // Comparar con initialMaxElo guardado al empezar, o con maxTotal si no existe
      const initialMax = this.plan.initialMaxElo ?? planElos?.maxTotal ?? 1500;
      if (this.eloTotal > initialMax) {
        this.launchConfetti();
      }
    } else {
      this.eloTotal = this.profileService.getEloTotalByPlanType(this.plan.planType);
      
      // Verificar si se superó el máximo histórico inicial (antes de empezar este juego)
      // Comparar con initialMaxElo guardado al empezar
      const initialMax = this.plan.initialMaxElo;
      if (initialMax !== undefined && this.eloTotal > initialMax) {
        this.launchConfetti();
      }
    }
  }

  /**
   * Lanza confetti para celebrar un nuevo récord de ELO total
   */
  private launchConfetti() {
    // Usar colores dorados para récord de ELO total
    const confettiColors = ['#FFD700', '#FFA500', '#FF8C00', '#FF6347'];
    const duration = 5000;
    const intensity: 'high' = 'high';

    this.confettiService.launch(confettiColors, duration, intensity);
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

  ngOnDestroy() {
    // Completar destroy$ para cancelar todas las suscripciones
    this.destroy$.next();
    this.destroy$.complete();

    // NO limpiar el plan aquí si se está navegando a training
    // Solo limpiar si realmente se está saliendo de la aplicación o yendo a home
    // El plan se limpiará cuando se cree uno nuevo en training-menu
  }

  openLoginModal() {
    this.modalController.create({
      component: LoginComponent,
      componentProps: {
        segmentEmailPassword: 'login'
      }
    }).then(modal => modal.present());
  }

  get exampleEloTotal(): number {
    // Elo de ejemplo para mostrar cuando no está logueado
    return 1500;
  }

  get examplePlan(): Plan | null {
    // Plan de ejemplo para mostrar estadísticas cuando no está logueado
    if (!this.plan) return null;

    return {
      ...this.plan,
      blocks: this.plan.blocks.map(block => ({
        ...block,
        puzzlesPlayed: block.puzzlesPlayed.map(puzzle => ({
          ...puzzle,
          resolved: Math.random() > 0.3, // 70% resueltos
          failByTime: Math.random() > 0.8, // 20% por tiempo
        }))
      }))
    };
  }

  async onRepeatPlan() {
    if (!this.plan || this.isLoadingToPlay) return;

    this.isLoadingToPlay = true;
    const loader = await this.loadingController.create({
      message: 'Preparando rutina...',
    });
    await loader.present();

    try {
      if (this.plan.planType === 'custom') {
        // Para planes custom, usar makeCustomPlanForPlay
        const planReadyToPlay = await this.planService.makeCustomPlanForPlay(this.plan);
        this.planFacade.setPlan(planReadyToPlay);
      } else {
        // Para planes por defecto, generar nuevos bloques
        const blocks: Block[] = await this.blockService.generateBlocksForPlan(this.plan.planType);

        // Cargar puzzles de todos los bloques en paralelo
        const total = blocks.length;
        let loaded = 0;

        const puzzlePromises = blocks.map(async (block) => {
          const puzzles = await this.blockService.getPuzzlesForBlock(block);
          block.puzzles = puzzles;
          loaded++;

          if (loader) {
            loader.message = `Cargando puzzles... ${loaded}/${total}`;
          }

          return block;
        });

        await Promise.all(puzzlePromises);
        await this.planService.newPlan(blocks, this.plan.planType);
      }

      await loader.dismiss();
      this.isLoadingToPlay = false;
      this.router.navigate(['/puzzles/training']);
    } catch (error) {
      await loader.dismiss();
      console.error('Error al repetir el plan:', error);
      this.isLoadingToPlay = false;
    }
  }
}

