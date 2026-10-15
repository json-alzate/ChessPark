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
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import {
  closeOutline,
  eye,
  homeOutline,
  playForwardOutline,
  playOutline,
  refreshOutline,
} from 'ionicons/icons';

import { Puzzle } from '@chesspark/models';
import { BoardPuzzleComponent, BoardPuzzleSolutionComponent } from '@chesspark/board';
import { ConfettiService, SoundsService } from '@chesspark/common-utils';

import { AppService } from '@core/app/app.service';
import { AnalyticsService } from '@core/analytics/analytics.service';
import { ProfileService } from '@core/account/profile.service';
import { TrainingReminderService } from '@features/reminders/services/training-reminder.service';
import { BoardResizeHandleComponent } from '@shared/components/board-resize-handle/board-resize-handle.component';
import { KingImagePipe } from '@shared/pipes/king-image.pipe';

import {
  RunnerCanvasComponent,
  RunnerEventName,
  RunnerProgress,
} from '../../components/runner-canvas/runner-canvas.component';
import { OBSTACLE_SHAPES } from '../../config/runner.config';
import { RunnerPiece, RunnerPieceKind, RunnerStats } from '../../models/runner.model';
import { RunnerPuzzleService } from '../../services/runner-puzzle.service';
import { RunnerStorageService } from '../../services/runner-storage.service';
import { buildRunnerSequence, spriteName } from '../../utils/runner-sequence.util';

/**
 * En qué punto está la pantalla:
 * - `loading`: buscando el ejercicio.
 * - `tutorial`: la primera vez, cómo se salta cada pieza.
 * - `running`: la carrera.
 * - `puzzle`: el ejercicio en el tablero, con su reloj.
 * - `result`: se resolvió, se falló o se acabó el tiempo.
 * - `error`: el catálogo no respondió.
 */
type RunnerPageStatus = 'loading' | 'tutorial' | 'running' | 'puzzle' | 'result' | 'error';

/** Cómo terminó el ejercicio. */
interface RunnerResult {
  kind: 'solved' | 'wrong' | 'timeout';
  puzzle: Puzzle;
}

/** Tiempo del ejercicio tras la carrera (la carrera no lo descuenta). */
const PUZZLE_TIMES = { total: 60, warningOn: 30, dangerOn: 15 } as const;
/** Pausa entre que Chocolate sale de la pantalla y aparece el tablero. */
const TRANSITION_MS = 450;
/** ELO de partida si no hay perfil. */
const DEFAULT_ELO = 1200;

/** Las piezas del tutorial, con lo que pide cada una. */
const TUTORIAL_PIECES: RunnerPieceKind[] = ['pawn', 'rook', 'bishop', 'knight', 'queen', 'king'];

/**
 * Chess Runner: un calentamiento antes de cada ejercicio. Chocolate corre y salta las piezas del
 * ejercicio como obstáculos; al superarlas aparece el tablero y el reloj. No toca el ELO ni crea un
 * `Plan`: es un modo suelto, como la Racha.
 */
@Component({
  selector: 'app-chess-runner',
  standalone: true,
  imports: [
    CommonModule,
    TranslocoPipe,
    IonContent,
    IonIcon,
    BoardPuzzleComponent,
    BoardResizeHandleComponent,
    KingImagePipe,
    RunnerCanvasComponent,
  ],
  templateUrl: './chess-runner.page.html',
  styleUrl: './chess-runner.page.scss',
})
export class ChessRunnerPage implements ViewWillEnter, ViewWillLeave, OnDestroy {
  private router = inject(Router);
  private puzzles = inject(RunnerPuzzleService);
  private storage = inject(RunnerStorageService);
  private analytics = inject(AnalyticsService);
  private profileService = inject(ProfileService);
  private reminders = inject(TrainingReminderService);
  private sounds = inject(SoundsService);
  private confetti = inject(ConfettiService);
  private appService = inject(AppService);
  private modalController = inject(ModalController);

  status: RunnerPageStatus = 'loading';

  /** El ejercicio de esta vuelta y las piezas de su carrera. */
  puzzle: Puzzle | null = null;
  sequence: RunnerPiece[] = [];
  progress: RunnerProgress = { cleared: 0, total: 0, stumbles: 0 };
  /** Lo que se cuenta de la carrera que acaba de terminar. */
  runStats: RunnerStats | null = null;

  /** El ejercicio con su reloj, ya en el tablero. */
  puzzleToPlay: Puzzle | null = null;
  forceStopBoardTimer = false;
  result: RunnerResult | null = null;

  /** Ejercicios resueltos en esta sesión. */
  solvedCount = 0;

  readonly tutorialPieces = TUTORIAL_PIECES.map((kind) => ({
    kind,
    hint: OBSTACLE_SHAPES[kind].hint,
    sprite: `assets/images/runner/${spriteName(kind, 'w')}.png`,
  }));

  private played = new Set<string>();
  private prefetched: Promise<Puzzle | null> | null = null;
  private sessionStarted = false;
  private runStartedAt = 0;
  private transitionTimeout: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;

  constructor() {
    addIcons({ closeOutline, eye, homeOutline, playForwardOutline, playOutline, refreshOutline });
  }

  /** Color con el que juega el usuario: el FEN arranca con el turno del rival. */
  get playerColor(): 'white' | 'black' {
    return this.puzzleToPlay?.fen.split(' ')[1] === 'w' ? 'black' : 'white';
  }

  /** Miniatura de una pieza de la carrera. */
  spriteOf(piece: RunnerPiece): string {
    return `assets/images/runner/${spriteName(piece.kind, piece.color)}.png`;
  }

  // ---------------------------------------------------------------- ciclo

  ionViewWillEnter(): void {
    this.played = new Set();
    this.solvedCount = 0;
    this.prefetched = null;
    this.sessionStarted = false;
    void this.loadNext();
  }

  ionViewWillLeave(): void {
    this.stopEverything();
  }

  ngOnDestroy(): void {
    this.stopEverything();
  }

  private stopEverything(): void {
    // Una carga que llegue tarde no debe pintar nada en una pantalla que ya se fue
    this.generation++;
    this.clearTransition();
    this.forceStopBoardTimer = true;
    this.puzzleToPlay = null;
    this.sequence = [];
    this.puzzle = null;
  }

  /** Busca el siguiente ejercicio y arma su carrera. */
  async loadNext(): Promise<void> {
    const generation = ++this.generation;
    this.clearTransition();
    this.status = 'loading';
    this.result = null;
    this.puzzleToPlay = null;
    this.forceStopBoardTimer = false;
    this.runStats = null;

    const pending = this.prefetched;
    this.prefetched = null;
    // Si la precarga no trajo nada (un fallo de red pasajero) se vuelve a intentar antes de dar error
    const puzzle =
      (pending ? await pending : null) ?? (await this.puzzles.next(this.userElo, this.played));

    // Se salió de la pantalla (o se pidió otro) mientras bajaba
    if (generation !== this.generation) {
      return;
    }
    if (!puzzle) {
      this.status = 'error';
      return;
    }

    this.puzzle = puzzle;
    this.played.add(puzzle.uid);
    this.sequence = buildRunnerSequence(puzzle.fen, puzzle.uid);
    this.progress = { cleared: 0, total: this.sequence.length, stumbles: 0 };

    if (this.sequence.length === 0) {
      // Un tablero sin piezas no tiene carrera: directo al ejercicio
      this.showPuzzle();
    } else if (!this.storage.isTutorialSeen()) {
      this.status = 'tutorial';
    } else {
      this.startRun();
    }
  }

  private get userElo(): number {
    return this.profileService.getProfile?.elo ?? DEFAULT_ELO;
  }

  // ------------------------------------------------------------- la carrera

  /** «A correr» desde el tutorial. */
  confirmTutorial(): void {
    this.storage.markTutorialSeen();
    this.startRun();
  }

  private startRun(): void {
    this.status = 'running';
    this.runStartedAt = Date.now();
    if (!this.sessionStarted) {
      this.sessionStarted = true;
      // No molestar con el recordatorio en mitad de la sesión que empieza
      this.reminders.onSessionStarted();
    }
    void this.analytics.logEvent('chess_runner_started', { obstacles: this.sequence.length });
  }

  onRunnerEvent(name: RunnerEventName): void {
    switch (name) {
      case 'jump':
      case 'doubleJump':
        this.sounds.playSelect();
        break;
      case 'cleared':
        this.sounds.playMoveSound();
        break;
      case 'stumble':
        this.sounds.playError();
        break;
      case 'finishing':
        this.sounds.playGood();
        break;
      default:
        break;
    }
  }

  onRunnerProgress(progress: RunnerProgress): void {
    this.progress = progress;
  }

  onRunnerFinished(stats: RunnerStats): void {
    if (this.status !== 'running') {
      return;
    }
    this.runStats = stats;
    void this.analytics.logEvent('chess_runner_finished', {
      obstacles: stats.total,
      stumbles: stats.stumbles,
      clean: stats.clean,
      duration_ms: stats.durationMs,
      skipped: false,
    });
    this.transitionTimeout = setTimeout(() => {
      this.transitionTimeout = null;
      this.showPuzzle();
    }, TRANSITION_MS);
  }

  /** «Saltar carrera»: directo al ejercicio. */
  skipRun(): void {
    if (this.status !== 'running') {
      return;
    }
    void this.analytics.logEvent('chess_runner_finished', {
      obstacles: this.sequence.length,
      stumbles: this.progress.stumbles,
      clean: false,
      duration_ms: Date.now() - this.runStartedAt,
      skipped: true,
    });
    this.showPuzzle();
  }

  /** Los recursos del runner no cargaron: se juega el ejercicio sin la carrera. */
  onRunnerFailed(): void {
    if (this.status === 'running') {
      this.showPuzzle();
    }
  }

  // ------------------------------------------------------------- el ejercicio

  private showPuzzle(): void {
    if (!this.puzzle) {
      return;
    }
    this.clearTransition();
    this.sequence = [];
    this.forceStopBoardTimer = false;
    this.puzzleToPlay = { ...this.puzzle, times: { ...PUZZLE_TIMES } };
    this.status = 'puzzle';

    void this.analytics.logEvent('puzzle_started', {
      routine_kind: 'runner',
      routine_minutes: 0,
      theme: this.puzzle.themes?.[0] ?? '',
      puzzle_elo: this.puzzle.rating ?? 0,
    });
    // Mientras se resuelve este, se baja el siguiente para que «Otro ejercicio» sea inmediato
    this.prefetched = this.puzzles.next(this.userElo, this.played);
  }

  onPuzzleSolved(puzzle: Puzzle): void {
    if (this.status !== 'puzzle') {
      return;
    }
    this.sounds.playGood();
    this.solvedCount++;
    this.finishPuzzle('solved', puzzle);
    this.confetti.launchTheme('gold');
  }

  onPuzzleFailed(puzzle: Puzzle): void {
    if (this.status !== 'puzzle') {
      return;
    }
    this.sounds.playError();
    this.finishPuzzle('wrong', puzzle);
  }

  onPuzzleEndByTime(puzzle: Puzzle): void {
    if (this.status !== 'puzzle') {
      return;
    }
    this.sounds.playError();
    this.finishPuzzle('timeout', puzzle);
  }

  private finishPuzzle(kind: RunnerResult['kind'], puzzle: Puzzle): void {
    this.result = { kind, puzzle };
    this.status = 'result';
    this.forceStopBoardTimer = true;

    void this.analytics.logEvent('puzzle_completed', {
      result: kind === 'solved' ? 'good' : kind === 'timeout' ? 'timeout' : 'bad',
      puzzle_elo: puzzle.rating ?? 0,
      user_elo: this.profileService.getProfile?.elo ?? 0,
      resolved_time: puzzle.timeUsed ?? 0,
      first_theme: puzzle.themes?.[0] ?? '',
      routine_kind: 'runner',
      routine_minutes: 0,
    });
    // Resolver (o fallar) un ejercicio cuenta como sesión de entrenamiento para el recordatorio
    this.reminders.onSessionCompleted({ createdAt: this.runStartedAt || Date.now() });
  }

  async showSolution(): Promise<void> {
    if (!this.result) {
      return;
    }
    const { puzzle } = this.result;
    const modal = await this.modalController.create({
      component: BoardPuzzleSolutionComponent,
      cssClass: 'puzzle-solution-modal',
      componentProps: {
        puzzle,
        themesTranslated: puzzle.themes.map((theme) =>
          this.appService.getNameThemePuzzleByValue(theme)
        ),
      },
    });
    await modal.present();
  }

  // ---------------------------------------------------------------- salidas

  retry(): void {
    void this.loadNext();
  }

  goToHome(): void {
    void this.router.navigate(['/home']);
  }

  private clearTransition(): void {
    if (this.transitionTimeout) {
      clearTimeout(this.transitionTimeout);
      this.transitionTimeout = null;
    }
  }
}
