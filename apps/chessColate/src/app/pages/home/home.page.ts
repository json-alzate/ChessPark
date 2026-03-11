import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  IonContent,
  IonIcon,
  LoadingController,
  ModalController,
  ViewWillEnter,
  ViewWillLeave,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowForward, statsChartOutline, eye } from 'ionicons/icons';

import { TranslocoPipe } from '@jsverse/transloco';

import { Block, PlanTypes, Puzzle } from '@cpark/models';

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

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    IonContent,
    IonIcon,
    CommonModule,
    RouterLink,
    TranslocoPipe,
    NavbarComponent,
    TrainingMenuComponent,
    BoardPuzzleComponent,
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

  constructor(private blockService: BlockService) {
    addIcons({ arrowForward, statsChartOutline, eye });
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
    // Inicialización movida a ionViewWillEnter para evitar fallos de caché al regresar
  }

  async ionViewWillEnter() {
    if (!this.infinitePuzzle) {
      await this.loadInfinitePuzzle();
    }
  }

  ionViewWillLeave() {
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
}
