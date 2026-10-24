import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import {
  AlertController,
  IonContent,
  IonIcon,
  ModalController,
  ViewWillEnter,
  ViewWillLeave,
} from '@ionic/angular/standalone';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { homeOutline } from 'ionicons/icons';

import { BoardPuzzleSolutionComponent } from '@chesspark/board';

import { AppService } from '@core/app/app.service';
import { themeLabel } from '@features/custom-puzzles/utils/pgn-puzzles.util';
import { STREAK_EXCLUDED_THEMES } from '@features/streak/utils/streak.util';
import { NavbarComponent } from '@shared/components/navbar/navbar.component';

import {
  WoodpeckerDashboardComponent,
  WoodpeckerProblemItem,
} from '../../components/woodpecker-dashboard/woodpecker-dashboard.component';
import { WoodpeckerSetupComponent } from '../../containers/woodpecker-setup/woodpecker-setup.component';
import { WoodpeckerState } from '../../models/woodpecker.model';
import { WoodpeckerService } from '../../services/woodpecker.service';
import {
  buildWoodpeckerConfig,
  WoodpeckerPgnSetupInput,
  WoodpeckerSetupInput,
} from '../../utils/woodpecker-config.util';
import { problemPuzzles } from '../../utils/woodpecker-stats.util';

/** Qué se ve: nada aún, configurar un set, armándose, o el panel del set. */
type HubView = 'loading' | 'setup' | 'generating' | 'dashboard';

/** Un aviso con su texto traducible. */
interface HubMessage {
  key: string;
  params?: Record<string, number>;
}

/**
 * Pájaro Carpintero: la pantalla del set. Sin set, deja configurarlo; con él,
 * enseña por dónde va y la evolución vuelta a vuelta. Solo hay un set a la vez.
 *
 * Quien juega las vueltas es `WoodpeckerPlayPage`; aquí se crea, se consulta y
 * se abandona.
 */
@Component({
  selector: 'app-woodpecker',
  standalone: true,
  imports: [
    CommonModule,
    TranslocoPipe,
    IonContent,
    IonIcon,
    NavbarComponent,
    WoodpeckerSetupComponent,
    WoodpeckerDashboardComponent,
  ],
  templateUrl: './woodpecker.page.html',
  styleUrl: './woodpecker.page.scss',
})
export class WoodpeckerPage implements ViewWillEnter, ViewWillLeave {
  private router = inject(Router);
  private woodpecker = inject(WoodpeckerService);
  private appService = inject(AppService);
  private translocoService = inject(TranslocoService);
  private alertController = inject(AlertController);
  private modalController = inject(ModalController);

  view: HubView = 'loading';
  state: WoodpeckerState | null = null;

  /** Cuántos archivos del catálogo van bajados mientras se arma el set. */
  generation = { done: 0, total: 0 };

  /** Por qué no se pudo armar el set. */
  error: HubMessage | null = null;
  /** Salieron menos ejercicios de los pedidos (solo justo tras crear el set). */
  shortNotice: { requested: number; actual: number } | null = null;

  themeNames: string[] = [];
  problemItems: WoodpeckerProblemItem[] = [];

  /** Hay un set y el usuario está armando otro que lo sustituirá. */
  replacingSet = false;

  constructor() {
    addIcons({ homeOutline });
  }

  get availableThemes(): string[] {
    return this.woodpecker.availableThemes;
  }

  get generationPercent(): number {
    return this.generation.total > 0
      ? (this.generation.done / this.generation.total) * 100
      : 0;
  }

  ionViewWillEnter(): void {
    // Mientras se arma el set, volver a la pantalla no debe taparlo
    if (this.view !== 'generating') {
      this.refresh();
    }
  }

  ionViewWillLeave(): void {
    this.shortNotice = null;
  }

  /** Relee lo guardado y elige qué enseñar. */
  private refresh(): void {
    this.state = this.woodpecker.load();
    this.replacingSet = false;

    if (!this.state) {
      this.view = 'setup';
      return;
    }
    this.themeNames = this.state.set.config.themes.map((theme) => this.themeName(theme));
    this.problemItems = this.buildProblemItems(this.state);
    this.view = 'dashboard';
  }

  private buildProblemItems(state: WoodpeckerState): WoodpeckerProblemItem[] {
    const puzzles = new Map(state.set.puzzles.map((puzzle) => [puzzle.uid, puzzle]));
    return problemPuzzles(state.progress.cycles).flatMap((problem) => {
      const puzzle = puzzles.get(problem.uidPuzzle);
      if (!puzzle) {
        return [];
      }
      return [
        {
          ...problem,
          rating: puzzle.rating,
          themes: this.tacticalThemes(puzzle.themes)
            .slice(0, 2)
            .map((theme) => this.themeName(theme))
            .join(' · '),
        },
      ];
    });
  }

  /** Nombre legible de un tema: el del catálogo, «Propio» para los sin tema, o el texto del PGN tal cual. */
  private themeName(theme: string): string {
    return themeLabel(
      theme,
      this.appService.getNameThemePuzzleByValue(theme),
      this.translocoService.translate('CUSTOM_PGN.themeCustom')
    );
  }

  /**
   * Los temas que nombran el motivo táctico, sin los que describen duración o
   * desenlace («Ventaja», «Ejercicio corto»): al reconocer un ejercicio en la
   * lista dicen más. Si no queda ninguno, se usan todos.
   */
  private tacticalThemes(themes: string[]): string[] {
    const tactical = themes.filter((theme) => !STREAK_EXCLUDED_THEMES.includes(theme));
    return tactical.length > 0 ? tactical : themes;
  }

  // ---------------------------------------------------------------- crear

  async onCreate(input: WoodpeckerSetupInput): Promise<void> {
    const config = buildWoodpeckerConfig(input, this.availableThemes);
    if (config.themes.length === 0) {
      this.error = { key: 'WOODPECKER.errors.noThemes' };
      return;
    }

    this.error = null;
    this.generation = { done: 0, total: 0 };
    this.view = 'generating';

    const creation = await this.woodpecker.createSet(config, (done, total) => {
      this.generation = { done, total };
    });

    switch (creation.status) {
      case 'ok':
        this.shortNotice = creation.short
          ? { requested: config.targetCount, actual: creation.set.puzzles.length }
          : null;
        this.refresh();
        return;
      case 'too-few':
        this.error = {
          key: 'WOODPECKER.errors.tooFew',
          params: { found: creation.found, required: creation.required },
        };
        break;
      case 'unavailable':
        this.error = { key: 'WOODPECKER.errors.unavailable' };
        break;
      case 'storage-full':
        this.error = { key: 'WOODPECKER.errors.storageFull' };
        break;
    }

    // No salió: se vuelve a lo que había (el set anterior sigue intacto)
    this.view = 'setup';
    this.replacingSet = !!this.woodpecker.getState();
  }

  /** Crea el set con los ejercicios de un PGN propio: no hay descarga, sale al momento. */
  onCreateFromPgn(input: WoodpeckerPgnSetupInput): void {
    this.error = null;

    const creation = this.woodpecker.createSetFromPgn(input);
    if (creation.status === 'ok') {
      this.shortNotice = null;
      this.refresh();
      return;
    }

    this.error = { key: 'WOODPECKER.errors.storageFull' };
    this.view = 'setup';
    this.replacingSet = !!this.woodpecker.getState();
  }

  /** «Armar otro set» desde el panel de un set terminado. */
  startNewSet(): void {
    this.error = null;
    this.replacingSet = true;
    this.view = 'setup';
  }

  /** Volver al panel desde la pantalla de configuración (solo hay set si se estaba reemplazando). */
  cancelNewSet(): void {
    this.error = null;
    this.refresh();
  }

  // ------------------------------------------------------------- acciones

  play(): void {
    void this.router.navigate(['/woodpecker/play']);
  }

  async confirmDiscard(): Promise<void> {
    const completed = this.woodpecker.isCompleted;
    const alert = await this.alertController.create({
      header: this.translocoService.translate('WOODPECKER.dashboard.discardConfirm.title'),
      message: this.translocoService.translate(
        completed
          ? 'WOODPECKER.dashboard.discardConfirm.messageCompleted'
          : 'WOODPECKER.dashboard.discardConfirm.message'
      ),
      buttons: [
        {
          text: this.translocoService.translate('WOODPECKER.dashboard.discardConfirm.cancel'),
          role: 'cancel',
        },
        {
          text: this.translocoService.translate('WOODPECKER.dashboard.discardConfirm.confirm'),
          role: 'confirm',
          handler: () => this.discard(),
        },
      ],
    });
    await alert.present();
  }

  private discard(): void {
    this.woodpecker.discard();
    this.error = null;
    this.shortNotice = null;
    this.refresh();
  }

  /** Enseña la solución de un ejercicio que se resiste. */
  async viewProblem(uid: string): Promise<void> {
    const puzzle = this.state?.set.puzzles.find((candidate) => candidate.uid === uid);
    if (!puzzle) {
      return;
    }
    const modal = await this.modalController.create({
      component: BoardPuzzleSolutionComponent,
      cssClass: 'puzzle-solution-modal',
      componentProps: {
        puzzle,
        themesTranslated: puzzle.themes.map((theme) => this.themeName(theme)),
      },
    });
    await modal.present();
  }

  goToHome(): void {
    void this.router.navigate(['/home']);
  }
}
