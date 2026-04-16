import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  IonContent,
  IonIcon,
  LoadingController,
  ModalController,
  IonModal,
  ViewWillEnter,
  ViewWillLeave,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowForward, statsChartOutline, eye, close, flash } from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { Store, select } from '@ngrx/store';
import { AuthState, getIsInitialized } from '@cpark/state';

import { TranslocoPipe } from '@jsverse/transloco';

import { Block, Plan, PlanTypes, Puzzle } from '@cpark/models';

// Services
import { BlockService } from '@services/block.service';
import { PlanService } from '@services/plan.service';
import { PuzzlesProvider } from '@chesspark/puzzles-provider';

import { ProfileService } from '@services/profile.service';

import { AppService } from '@services/app.service';

// Components
import { NavbarComponent } from '@shared/components/navbar/navbar.component';
import { TrainingMenuComponent } from './components/training-menu.component';
import { BoardPuzzleComponent, BoardPuzzleSolutionComponent } from '@chesspark/board';
import { PlanChartComponent } from '../puzzles/components/plan-chart/plan-chart.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    IonContent,
    IonModal,
    IonIcon,
    CommonModule,
    RouterLink,
    TranslocoPipe,
    NavbarComponent,
    TrainingMenuComponent,
    BoardPuzzleComponent,
    PlanChartComponent,
  ],
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit, ViewWillEnter, ViewWillLeave {
  infinitePuzzle: Puzzle | null = null;
  isInfinitePuzzleSolved = false;
  infinitePuzzleProblemState: 'none' | 'good' | 'bad' | 'timeOut' = 'none';
  isLoadingPuzzle = true;

  get playerColor(): 'white' | 'black' {
    if (!this.infinitePuzzle) return 'white';
    return this.infinitePuzzle.fen.split(' ')[1] === 'w' ? 'black' : 'white';
  }

  isStatsModalOpen = false;
  infinityPlanProps = { planType: 'infinity' as PlanTypes } as Plan;

  get infinityElo(): number | string {
    const profile = this.profileService.getProfile;
    // We cast to any to avoid strict type error since 'infinityTotal' might not be explicitly typed yet
    const elos = profile?.elos as any;
    if (elos && typeof elos['infinityTotal'] === 'number') {
      return elos['infinityTotal'];
    }
    return '1500?';
  }

  private router = inject(Router);
  private planService = inject(PlanService);
  private puzzlesProvider = inject(PuzzlesProvider);
  private loadingController = inject(LoadingController);
  private profileService = inject(ProfileService);
  private appService = inject(AppService);
  private modalController = inject(ModalController);
  private store = inject(Store<AuthState>);

  isInitialized = false;
  private initSubscription?: Subscription;

  constructor(private blockService: BlockService) {
    addIcons({ arrowForward, statsChartOutline, eye, close, flash });
  }

  async showSolution() {
    if (!this.infinitePuzzle) return;

    const themesTranslated = this.infinitePuzzle.themes.map((theme) =>
      this.appService.getNameThemePuzzleByValue(theme)
    );

    const modal = await this.modalController.create({
      component: BoardPuzzleSolutionComponent,
      componentProps: {
        puzzle: this.infinitePuzzle,
        themesTranslated,
      },
    });
    await modal.present();
  }

  async ngOnInit() {
    this.initSubscription = this.store.pipe(select(getIsInitialized)).subscribe(initialized => {
      this.isInitialized = initialized;
    });
  }

  reto333Stats: any = null;
  isLoadingReto333 = true;

  ionViewWillEnter() {
    if (!this.infinitePuzzle) {
      this.loadInfinitePuzzle();
    }
    
    this.isLoadingReto333 = true;
    
    // Cargar estadísticas del Reto 333
    setTimeout(() => {
      const statsStr = localStorage.getItem('chesscolate_reto333_stats');
      if (statsStr) {
        try {
          this.reto333Stats = JSON.parse(statsStr);
        } catch (e) {
          console.error('Error parseando las stats del reto 333:', e);
        }
      }
      this.isLoadingReto333 = false;
    }, 500);
  }

  ionViewWillLeave() {
    if (this.initSubscription) {
      this.initSubscription.unsubscribe();
    }
    // Limpiar para asegurar destrucción del component BoardPuzzle
    this.infinitePuzzle = null;
    this.isInfinitePuzzleSolved = false;
    this.infinitePuzzleProblemState = 'none';
  }

  async loadInfinitePuzzle() {
    this.isLoadingPuzzle = true;
    this.isInfinitePuzzleSolved = false;
    const puzzles = await this.puzzlesProvider.getPuzzles({
      elo: 1500,
    });
    if (puzzles && puzzles.length > 0) {
      this.infinitePuzzle = puzzles[0];
    }
    this.isLoadingPuzzle = false;
  }

  onInfinitePuzzleCompleted(state?: 'good' | 'bad' | 'timeOut') {
    this.isInfinitePuzzleSolved = true;
    if (state) {
      this.infinitePuzzleProblemState = state;
    }
  }

  async startInfinityPlan() {
    const loader = await this.loadingController.create({
      message: 'Iniciando entrenamiento...',
    });
    await loader.present();

    try {
      const blocks: Block[] = await this.blockService.generateBlocksForPlan(
        'infinity'
      );

      // Cargar puzzles iniciales
      const puzzles = await this.blockService.getPuzzlesForBlock(blocks[0]);
      blocks[0].puzzles = puzzles;

      await this.planService.newPlan(blocks, 'infinity');

      await loader.dismiss();
      this.router.navigate(['/puzzles/training']);
    } catch (error) {
      await loader.dismiss();
      console.error('Error al iniciar el plan infinito:', error);
    }
  }

  async startReto333Plan() {
    const loader = await this.loadingController.create({
      message: 'Iniciando Reto 333...',
    });
    await loader.present();

    try {
      const blocks: Block[] = await this.blockService.generateBlocksForPlan(
        'reto333'
      );

      // Cargar puzzles iniciales
      const puzzles = await this.blockService.getPuzzlesForBlock(blocks[0]);
      blocks[0].puzzles = puzzles;

      await this.planService.newPlan(blocks, 'reto333');

      await loader.dismiss();
      this.router.navigate(['/puzzles/training']);
    } catch (error) {
      await loader.dismiss();
      console.error('Error al iniciar el reto 333:', error);
    }
  }
}
