import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import {
  IonContent,
  IonIcon,
  ModalController,
  ViewWillEnter,
  ViewWillLeave,
} from '@ionic/angular/standalone';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import {
  closeOutline,
  eye,
  homeOutline,
  playForwardOutline,
  playOutline,
  repeatOutline,
  trophy,
} from 'ionicons/icons';

import { Puzzle } from '@chesspark/models';
import { BoardPuzzleComponent, BoardPuzzleSolutionComponent } from '@chesspark/board';
import { ConfettiService, SoundsService } from '@chesspark/common-utils';

import { AppService } from '@core/app/app.service';
import { AnalyticsService } from '@core/analytics/analytics.service';
import { ProfileService } from '@core/account/profile.service';
import { themeLabel } from '@features/custom-puzzles/utils/pgn-puzzles.util';
import { TrainingReminderService } from '@features/reminders/services/training-reminder.service';
import { KingImagePipe } from '@shared/pipes/king-image.pipe';
import { BoardResizeHandleComponent } from '@shared/components/board-resize-handle/board-resize-handle.component';

import { WoodpeckerCycleResultComponent } from '../../components/woodpecker-cycle-result/woodpecker-cycle-result.component';
import {
  WoodpeckerCycleComparison,
  WoodpeckerCycleSummary,
} from '../../models/woodpecker.model';
import { WoodpeckerService } from '../../services/woodpecker.service';
import { clampRecordedTime } from '../../utils/woodpecker-stats.util';

/**
 * En qué punto está la pantalla:
 * - `ready`: aviso de la vuelta antes de empezar (reloj, qué toca).
 * - `playing`: ejercicio en el tablero.
 * - `feedback`: se falló o se acabó el tiempo; se puede ver la solución.
 * - `cycleDone`: vuelta terminada, con su resultado.
 */
type PlayStatus = 'loading' | 'ready' | 'playing' | 'feedback' | 'cycleDone';

/** Cómo terminó el ejercicio que se está viendo en el aviso. */
interface Feedback {
  kind: 'wrong' | 'timeout';
  puzzle: Puzzle;
}

/**
 * Juega una vuelta del Pájaro Carpintero: los ejercicios del set, uno tras
 * otro y en el orden de la vuelta. Cada resultado se guarda al momento, así
 * que se puede salir en cualquier punto y retomar donde se quedó.
 *
 * A diferencia de la Racha, fallar no termina nada: se anota, se puede ver la
 * solución y se sigue. Lo que se mide es la mejora entre vueltas.
 */
@Component({
  selector: 'app-woodpecker-play',
  standalone: true,
  imports: [
    BoardResizeHandleComponent,
    CommonModule,
    TranslocoPipe,
    IonContent,
    IonIcon,
    BoardPuzzleComponent,
    KingImagePipe,
    WoodpeckerCycleResultComponent,
  ],
  templateUrl: './woodpecker-play.page.html',
  styleUrl: './woodpecker-play.page.scss',
})
export class WoodpeckerPlayPage implements ViewWillEnter, ViewWillLeave, OnDestroy {
  private router = inject(Router);
  private woodpecker = inject(WoodpeckerService);
  private analytics = inject(AnalyticsService);
  private profileService = inject(ProfileService);
  private reminders = inject(TrainingReminderService);
  private sounds = inject(SoundsService);
  private confetti = inject(ConfettiService);
  private appService = inject(AppService);
  private modalController = inject(ModalController);
  private translocoService = inject(TranslocoService);

  status: PlayStatus = 'loading';

  /** Ejercicio en el tablero. `null` mientras no se juega (aviso, resultado). */
  puzzleToPlay: Puzzle | null = null;
  /** Detiene el reloj del tablero mientras no hay ejercicio vivo. */
  forceStopBoardTimer = false;

  feedback: Feedback | null = null;

  /** Resultado de la vuelta recién terminada. */
  cycleResult: {
    current: WoodpeckerCycleSummary;
    comparison: WoodpeckerCycleComparison | null;
    finishedSet: boolean;
  } | null = null;

  /** Datos de la vuelta para el aviso y el marcador. */
  cycleNumber = 0;
  totalCycles = 0;
  setSize = 0;
  /** Segundos por ejercicio de esta vuelta; `null` sin reloj. */
  secondsPerPuzzle: number | null = null;
  answered = 0;
  solved = 0;

  /**
   * Respiro tras acertar, para que se vea la jugada buena antes del siguiente
   * ejercicio. Sin él, una vuelta de cientos de ejercicios se vuelve un
   * parpadeo donde no se registra el acierto.
   */
  private readonly SOLVED_PAUSE_MS = 450;

  /**
   * Entre el acierto y el ejercicio siguiente el tablero sigue a la vista y
   * admite jugadas: sin esta bandera, un toque de más contaría como fallo.
   */
  private awaitingNext = false;
  private pauseTimeout: ReturnType<typeof setTimeout> | null = null;

  /** Cuándo se puso el ejercicio actual en el tablero, para medir lo que tarda. */
  private shownAt = 0;
  private cycleStartedAt = 0;

  constructor() {
    addIcons({
      closeOutline,
      eye,
      homeOutline,
      playForwardOutline,
      playOutline,
      repeatOutline,
      trophy,
    });
  }

  /** Color con el que juega el usuario. El FEN arranca con el turno del rival. */
  get playerColor(): 'white' | 'black' {
    return this.puzzleToPlay?.fen.split(' ')[1] === 'w' ? 'black' : 'white';
  }

  get progressPercent(): number {
    return this.setSize > 0 ? (this.answered / this.setSize) * 100 : 0;
  }

  get isResuming(): boolean {
    return this.answered > 0;
  }

  get isFirstCycle(): boolean {
    return this.cycleNumber === 1;
  }

  /** ¿Queda otra vuelta tras la que se acaba de terminar? */
  get hasNextCycle(): boolean {
    return !!this.cycleResult && !this.cycleResult.finishedSet;
  }

  // ---------------------------------------------------------------- ciclo

  ionViewWillEnter(): void {
    this.prepareCycle();
  }

  ionViewWillLeave(): void {
    this.stopPlaying();
  }

  ngOnDestroy(): void {
    this.stopPlaying();
  }

  /** Abre (o retoma) la vuelta que toca y enseña el aviso. */
  private prepareCycle(): void {
    this.stopPlaying();
    this.cycleResult = null;
    this.feedback = null;

    const state = this.woodpecker.load();
    // Sin set, o con el set ya terminado, aquí no hay nada que jugar
    const cycle = state && !this.woodpecker.isCompleted ? this.woodpecker.beginCycle() : null;
    if (!state || !cycle) {
      void this.router.navigate(['/woodpecker'], { replaceUrl: true });
      return;
    }

    this.cycleNumber = cycle.cycle;
    this.cycleStartedAt = cycle.startedAt;
    this.totalCycles = state.set.config.cycles;
    this.setSize = cycle.order.length;
    this.secondsPerPuzzle = this.woodpecker.timesForActiveCycle()?.total ?? null;
    this.refreshScore();
    this.forceStopBoardTimer = false;
    this.status = 'ready';
  }

  /** «Empezar» o «Continuar» desde el aviso. */
  startPlaying(): void {
    // No molestar con el recordatorio en mitad de la sesión que empieza
    this.reminders.onSessionStarted();
    this.showNextPuzzle();
  }

  /** Pone en el tablero el ejercicio que toca, o cierra la vuelta si no queda ninguno. */
  private showNextPuzzle(): void {
    this.clearPause();
    const puzzle = this.woodpecker.nextPuzzle();
    if (!puzzle) {
      this.finishCycle();
      return;
    }

    this.feedback = null;
    this.forceStopBoardTimer = false;
    // El tiempo lo fija la vuelta, no el ejercicio: así el mismo ejercicio
    // tiene menos tiempo en cada pasada
    this.puzzleToPlay = { ...puzzle, times: this.woodpecker.timesForActiveCycle() };
    this.shownAt = Date.now();
    this.status = 'playing';

    void this.analytics.logEvent('puzzle_started', {
      routine_kind: 'woodpecker',
      routine_minutes: 0,
      theme: puzzle.themes?.[0] ?? '',
      puzzle_elo: puzzle.rating ?? 0,
    });
  }

  // ------------------------------------------------------------- jugadas

  onPuzzleSolved(puzzle: Puzzle): void {
    if (this.status !== 'playing' || this.awaitingNext) {
      return;
    }
    this.sounds.playGood();
    this.recordResult(puzzle, true, false);

    // Se deja ver la jugada buena antes de pasar al siguiente
    this.awaitingNext = true;
    this.pauseTimeout = setTimeout(() => {
      this.pauseTimeout = null;
      this.awaitingNext = false;
      this.showNextPuzzle();
    }, this.SOLVED_PAUSE_MS);
  }

  onPuzzleFailed(puzzle: Puzzle): void {
    if (this.status !== 'playing' || this.awaitingNext) {
      return;
    }
    this.sounds.playError();
    this.recordResult(puzzle, false, false);
    this.showFeedback('wrong', puzzle);
  }

  onPuzzleEndByTime(puzzle: Puzzle): void {
    if (this.status !== 'playing' || this.awaitingNext) {
      return;
    }
    this.sounds.playError();
    this.recordResult(puzzle, false, true);
    this.showFeedback('timeout', puzzle);
  }

  private recordResult(puzzle: Puzzle, resolved: boolean, failByTime: boolean): void {
    const timeMs = clampRecordedTime(Date.now() - this.shownAt);
    this.woodpecker.registerResult({
      uidPuzzle: puzzle.uid,
      resolved,
      failByTime,
      timeMs,
    });
    this.refreshScore();

    void this.analytics.logEvent('puzzle_completed', {
      result: resolved ? 'good' : failByTime ? 'timeout' : 'bad',
      puzzle_elo: puzzle.rating ?? 0,
      user_elo: this.profileService.getProfile?.elo ?? 0,
      resolved_time: Math.round(timeMs / 1000),
      first_theme: puzzle.themes?.[0] ?? '',
      routine_kind: 'woodpecker',
      routine_minutes: 0,
    });
  }

  private showFeedback(kind: Feedback['kind'], puzzle: Puzzle): void {
    this.feedback = { kind, puzzle };
    this.status = 'feedback';
  }

  /** «Siguiente» tras un fallo. */
  continueAfterFeedback(): void {
    this.showNextPuzzle();
  }

  /** Enseña la solución del ejercicio que se falló. */
  async showSolution(): Promise<void> {
    if (!this.feedback) {
      return;
    }
    const { puzzle } = this.feedback;
    const modal = await this.modalController.create({
      component: BoardPuzzleSolutionComponent,
      cssClass: 'puzzle-solution-modal',
      componentProps: {
        puzzle,
        themesTranslated: puzzle.themes.map((theme) =>
          themeLabel(
            theme,
            this.appService.getNameThemePuzzleByValue(theme),
            this.translocoService.translate('CUSTOM_PGN.themeCustom')
          )
        ),
      },
    });
    await modal.present();
  }

  // ---------------------------------------------------------------- final

  private finishCycle(): void {
    this.forceStopBoardTimer = true;
    this.puzzleToPlay = null;

    const report = this.woodpecker.completeCycle();
    if (!report) {
      void this.router.navigate(['/woodpecker'], { replaceUrl: true });
      return;
    }

    this.cycleResult = {
      current: report.current,
      comparison: report.comparison,
      finishedSet: report.finishedSet,
    };
    // Una vuelta es una sesión de entrenamiento: cuenta para la hora habitual
    this.reminders.onSessionCompleted({ createdAt: this.cycleStartedAt });

    this.status = 'cycleDone';
    if (report.finishedSet) {
      this.confetti.launchTheme('gold');
    }
  }

  /** «Empezar vuelta N+1»: otra vez el aviso, no directo al tablero. */
  nextCycle(): void {
    this.prepareCycle();
  }

  // ------------------------------------------------------------ utilidades

  private refreshScore(): void {
    const summary = this.woodpecker.activeCycleSummary();
    this.answered = summary?.answered ?? 0;
    this.solved = summary?.solved ?? 0;
  }

  /** Deja de jugar sin perder nada: lo anotado ya está guardado. */
  private stopPlaying(): void {
    this.clearPause();
    this.forceStopBoardTimer = true;
    this.puzzleToPlay = null;
  }

  private clearPause(): void {
    if (this.pauseTimeout) {
      clearTimeout(this.pauseTimeout);
      this.pauseTimeout = null;
    }
    this.awaitingNext = false;
  }

  /** El progreso está guardado: salir no pierde nada. */
  exit(): void {
    void this.router.navigate(['/woodpecker']);
  }

  goToHome(): void {
    void this.router.navigate(['/home']);
  }
}
