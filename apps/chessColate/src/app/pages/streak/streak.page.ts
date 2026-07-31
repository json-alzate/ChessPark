import { Component, inject, OnDestroy } from '@angular/core';
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
import {
  closeOutline,
  flame,
  playForwardOutline,
  trophy,
  eye,
  refreshOutline,
  homeOutline,
} from 'ionicons/icons';

import {
  Puzzle,
  StreakConfig,
  StreakEndReason,
  StreakRecord,
  StreakRun,
} from '@cpark/models';
import { BoardPuzzleComponent, BoardPuzzleSolutionComponent } from '@chesspark/board';
import {
  ConfettiService,
  SoundsService,
  UidGeneratorService,
} from '@chesspark/common-utils';

import { AppService } from '@services/app.service';
import { AnalyticsService } from '@services/analytics.service';
import { ProfileService } from '@services/profile.service';
import { StreakService } from '@services/streak.service';
import { StreakStorageService } from '@services/streak-storage.service';
import { TrainingReminderService } from '@services/training-reminder.service';
import {
  DEFAULT_STREAK_CONFIG,
  isNewRecord,
  nextTargetElo,
} from '@services/streak.util';

/** En qué punto está la pantalla. */
type StreakStatus = 'loading' | 'playing' | 'finished' | 'error';

/**
 * Modo Racha: puzzles encadenados de dificultad creciente donde el primer
 * fallo termina la partida. Sin reloj y sin pistas; queda un salto por racha.
 *
 * Vive fuera del flujo de rutinas (no crea un `Plan` ni pasa por bloques):
 * el puzzle se pide de a uno con el elo que marca la rampa, y la puntuación
 * es simplemente cuántos encadenó el usuario.
 */
@Component({
  selector: 'app-streak',
  standalone: true,
  imports: [
    CommonModule,
    TranslocoPipe,
    IonContent,
    IonIcon,
    BoardPuzzleComponent,
  ],
  templateUrl: './streak.page.html',
  styleUrls: ['./streak.page.scss'],
})
export class StreakPage implements ViewWillEnter, ViewWillLeave, OnDestroy {
  private router = inject(Router);
  private streakService = inject(StreakService);
  private streakStorage = inject(StreakStorageService);
  private profileService = inject(ProfileService);
  private analyticsService = inject(AnalyticsService);
  private trainingReminderService = inject(TrainingReminderService);
  private soundsService = inject(SoundsService);
  private confettiService = inject(ConfettiService);
  private uidGenerator = inject(UidGeneratorService);
  private translocoService = inject(TranslocoService);
  private alertController = inject(AlertController);
  private modalController = inject(ModalController);
  private appService = inject(AppService);

  readonly config: StreakConfig = { ...DEFAULT_STREAK_CONFIG };

  status: StreakStatus = 'loading';

  /** Puzzles resueltos seguidos: la puntuación de la racha en curso. */
  score = 0;
  skipsUsed = 0;

  puzzleToPlay: Puzzle | null = null;
  record: StreakRecord = this.streakStorage.getRecord();

  /** Resultado de la racha terminada, para la pantalla de fin. */
  finishedRun: StreakRun | null = null;
  achievedNewRecord = false;

  /** El puzzle que rompió la racha, para poder ver la solución al final. */
  private failedPuzzle: Puzzle | null = null;

  /** Detiene el tablero mientras se carga el siguiente puzzle o al terminar. */
  forceStopBoardTimer = false;

  private runUid = '';
  private startedAt = 0;

  /**
   * Elo con el que se pide el puzzle actual. No se enseña: al usuario se le
   * muestra el elo real del ejercicio que tiene delante.
   */
  private targetElo = DEFAULT_STREAK_CONFIG.eloBase;
  private maxEloReached = 0;
  private playedUids = new Set<string>();
  private playedOrder: string[] = [];
  private runFinished = true;

  /**
   * Respiro tras acertar, para que se vea la jugada buena antes de que entre el
   * siguiente puzzle. Sin él la racha va tan rápido que no se registra el logro.
   */
  private readonly SOLVED_PAUSE_MS = 450;

  /**
   * Entre el acierto y el puzzle siguiente el tablero sigue a la vista y admite
   * jugadas: sin esta bandera, un toque de más se leería como fallo y rompería
   * la racha injustamente.
   */
  private awaitingNextPuzzle = false;
  private solvedPauseTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * Siguiente puzzle ya descargado mientras el usuario resuelve el actual, para
   * que la transición sea instantánea. Se guarda con el elo con el que se pidió
   * para descartarlo si la rampa cambió de sitio (por ejemplo tras un salto).
   */
  private prefetched: { elo: number; puzzle: Puzzle } | null = null;

  constructor() {
    addIcons({
      closeOutline,
      flame,
      playForwardOutline,
      trophy,
      eye,
      refreshOutline,
      homeOutline,
    });
  }

  ionViewWillEnter() {
    this.startRun();
  }

  ionViewWillLeave() {
    // Salir con la racha viva (botón atrás, gesto, menú) cuenta como abandono:
    // lo logrado hasta aquí se registra, pero sin pantalla de resultado.
    this.finishRun('quit', { silent: true });
  }

  ngOnDestroy() {
    this.finishRun('quit', { silent: true });
  }

  /** Color con el que juega el usuario en el puzzle actual. */
  get playerColor(): 'white' | 'black' {
    // El FEN del puzzle arranca con el turno del rival: el usuario juega el otro.
    return this.puzzleToPlay?.fen.split(' ')[1] === 'w' ? 'black' : 'white';
  }

  get skipsLeft(): number {
    return Math.max(0, this.config.maxSkips - this.skipsUsed);
  }

  /** Elo real del ejercicio que se está jugando. */
  get puzzleElo(): number {
    return this.puzzleToPlay?.rating ?? this.targetElo;
  }

  /** Cuánto le falta para batir su récord (0 si ya lo superó o no tiene). */
  get toBeatRecord(): number {
    return Math.max(0, this.record.bestScore - this.score);
  }

  // ---------------------------------------------------------------- ciclo

  async startRun() {
    this.clearSolvedPause();
    this.record = this.streakStorage.getRecord();
    this.score = 0;
    this.skipsUsed = 0;
    this.playedUids = new Set<string>();
    this.playedOrder = [];
    this.prefetched = null;
    this.failedPuzzle = null;
    this.finishedRun = null;
    this.achievedNewRecord = false;
    this.puzzleToPlay = null;
    this.forceStopBoardTimer = false;

    this.runUid = this.uidGenerator.generateSimpleUid();
    this.startedAt = Date.now();
    this.targetElo = this.config.eloBase;
    this.maxEloReached = 0;
    this.runFinished = false;
    this.status = 'loading';

    void this.analyticsService.logEvent('streak_started', {
      elo_base: this.config.eloBase,
      step: this.config.step,
      theme: this.config.theme,
    });

    // No molestar con el recordatorio en mitad de la sesión que empieza
    this.trainingReminderService.onSessionStarted();

    await this.loadPuzzle();
  }

  /** Carga el puzzle correspondiente al elo actual de la rampa. */
  private async loadPuzzle() {
    const targetElo = this.targetElo;

    const ready =
      this.prefetched?.elo === targetElo ? this.prefetched.puzzle : null;
    this.prefetched = null;

    const puzzle =
      ready ??
      (await this.streakService.getPuzzleForElo(
        targetElo,
        this.config,
        this.playedUids
      ));

    // La racha pudo terminar mientras se descargaba (fallo, salida): en ese
    // caso el puzzle que llega ya no pinta nada.
    if (this.runFinished) {
      return;
    }

    if (!puzzle) {
      this.status = 'error';
      return;
    }

    this.playedUids.add(puzzle.uid);
    this.playedOrder.push(puzzle.uid);
    this.puzzleToPlay = puzzle;
    this.awaitingNextPuzzle = false;
    this.status = 'playing';
    // La dificultad máxima del resumen es la que de verdad se llegó a jugar,
    // incluido el puzzle que rompe la racha.
    this.maxEloReached = Math.max(this.maxEloReached, puzzle.rating ?? 0);

    void this.analyticsService.logEvent('puzzle_started', {
      routine_kind: 'streak',
      routine_minutes: 0,
      theme: puzzle.themes?.[0] ?? '',
      puzzle_elo: puzzle.rating ?? 0,
    });

    this.prefetchNext(puzzle);
  }

  /**
   * Descarga por adelantado el puzzle del siguiente escalón mientras el usuario
   * resuelve el actual. Se puede saber ya porque el objetivo siguiente sale del
   * elo real de este puzzle. Si la racha termina antes, se descarta.
   */
  private prefetchNext(currentPuzzle: Puzzle) {
    const nextElo = this.eloAfterSolving(currentPuzzle);
    this.streakService
      .getPuzzleForElo(nextElo, this.config, this.playedUids)
      .then((puzzle) => {
        if (puzzle && !this.runFinished) {
          this.prefetched = { elo: nextElo, puzzle };
        }
      })
      .catch((error) =>
        console.warn('Error precargando el siguiente puzzle:', error)
      );
  }

  /** Objetivo del siguiente puzzle si el usuario resuelve el que tiene delante. */
  private eloAfterSolving(puzzle: Puzzle): number {
    return nextTargetElo(
      puzzle.rating ?? this.targetElo,
      this.targetElo,
      this.config
    );
  }

  // ------------------------------------------------------------- jugadas

  onPuzzleSolved(puzzle: Puzzle) {
    if (this.runFinished || this.awaitingNextPuzzle) {
      return;
    }

    this.score++;
    this.soundsService.playGood();

    void this.analyticsService.logEvent('puzzle_completed', {
      result: 'good',
      puzzle_elo: puzzle.rating ?? 0,
      user_elo: this.profileService.getProfile?.elo ?? 0,
      resolved_time: puzzle.timeUsed ?? 0,
      first_theme: puzzle.themes?.[0] ?? '',
      routine_kind: 'streak',
      routine_minutes: 0,
    });

    // La rampa se encadena sobre el elo real de lo que acaba de resolver
    this.targetElo = this.eloAfterSolving(puzzle);

    this.awaitingNextPuzzle = true;
    this.solvedPauseTimeout = setTimeout(() => {
      this.solvedPauseTimeout = null;
      if (this.runFinished) {
        return;
      }
      this.status = 'loading';
      void this.loadPuzzle();
    }, this.SOLVED_PAUSE_MS);
  }

  onPuzzleFailed(puzzle: Puzzle) {
    if (this.runFinished || this.awaitingNextPuzzle) {
      return;
    }

    this.soundsService.playError();
    // El puzzle que emite el tablero trae además la posición de arranque y la
    // primera jugada resaltada, que es lo que necesita la vista de solución.
    this.failedPuzzle = puzzle;

    void this.analyticsService.logEvent('puzzle_completed', {
      result: 'bad',
      puzzle_elo: puzzle.rating ?? 0,
      user_elo: this.profileService.getProfile?.elo ?? 0,
      resolved_time: puzzle.timeUsed ?? 0,
      first_theme: puzzle.themes?.[0] ?? '',
      routine_kind: 'streak',
      routine_minutes: 0,
    });

    this.finishRun('fail');
  }

  /** Salto: pasa de puzzle sin contarlo como fallo ni como acierto. */
  useSkip() {
    if (
      this.runFinished ||
      this.awaitingNextPuzzle ||
      this.skipsLeft === 0 ||
      this.status !== 'playing'
    ) {
      return;
    }

    this.skipsUsed++;

    void this.analyticsService.logEvent('streak_skip_used', {
      at_score: this.score,
      elo: this.puzzleElo,
    });

    this.status = 'loading';
    // El objetivo no se mueve: mismo nivel, otro puzzle.
    void this.loadPuzzle();
  }

  // -------------------------------------------------------------- final

  /**
   * Cierra la racha, guarda el récord y muestra el resultado.
   * `silent` lo usan las salidas de pantalla: registran lo logrado sin abrir
   * la pantalla de fin (el usuario ya se está yendo).
   */
  private finishRun(
    endedBy: StreakEndReason,
    options: { silent?: boolean } = {}
  ) {
    if (this.runFinished) {
      return;
    }

    this.runFinished = true;
    this.forceStopBoardTimer = true;
    this.clearSolvedPause();

    const run: StreakRun = {
      uid: this.runUid,
      uidUser: this.profileService.getProfile?.uid,
      startedAt: this.startedAt,
      finishedAt: Date.now(),
      config: this.config,
      score: this.score,
      skipsUsed: this.skipsUsed,
      endedBy,
      puzzleUids: [...this.playedOrder],
      failedPuzzleUid:
        endedBy === 'fail' ? this.failedPuzzle?.uid : undefined,
      maxEloReached: this.maxEloReached,
    };

    const previousBest = this.record.bestScore;
    const beatsRecord = isNewRecord(run.score, this.record);

    // Asomarse al modo y salir sin resolver nada no es una racha: no ensucia el
    // historial ni deja un "0" en la tarjeta del inicio. Fallar el primer puzzle
    // sí cuenta, porque ahí sí se jugó.
    const worthRecording = run.score > 0 || endedBy === 'fail';
    if (worthRecording) {
      this.record = this.streakStorage.saveRun(run);
    }
    this.finishedRun = run;
    this.achievedNewRecord = beatsRecord;

    void this.analyticsService.logEvent('streak_ended', {
      score: run.score,
      ended_by: endedBy,
      skips_used: run.skipsUsed,
      max_elo_reached: run.maxEloReached,
      duration_ms: (run.finishedAt ?? run.startedAt) - run.startedAt,
    });

    if (beatsRecord) {
      void this.analyticsService.logEvent('streak_new_record', {
        score: run.score,
        previous_best: previousBest,
      });
    }

    if (worthRecording) {
      // Una racha es una sesión de entrenamiento: cuenta para la hora habitual
      this.trainingReminderService.onSessionCompleted({
        createdAt: run.startedAt,
      });
    }

    if (options.silent) {
      return;
    }

    this.status = 'finished';
    if (beatsRecord && run.score > 0) {
      this.confettiService.launchTheme('gold');
    }
  }

  private clearSolvedPause() {
    if (this.solvedPauseTimeout) {
      clearTimeout(this.solvedPauseTimeout);
      this.solvedPauseTimeout = null;
    }
    this.awaitingNextPuzzle = false;
  }

  /** Muestra la solución del puzzle que rompió la racha. */
  async showFailedSolution() {
    if (!this.failedPuzzle) {
      return;
    }

    const themesTranslated = this.failedPuzzle.themes.map((theme) =>
      this.appService.getNameThemePuzzleByValue(theme)
    );

    const modal = await this.modalController.create({
      component: BoardPuzzleSolutionComponent,
      cssClass: 'puzzle-solution-modal',
      componentProps: {
        puzzle: this.failedPuzzle,
        themesTranslated,
      },
    });

    await modal.present();
  }

  /** Reintentar: arranca una racha nueva desde el elo base. */
  retry() {
    void this.startRun();
  }

  goToHome() {
    this.router.navigate(['/home']);
  }

  /** Salir con la racha viva: pide confirmación para no perderla sin querer. */
  async onExit() {
    if (this.runFinished) {
      this.goToHome();
      return;
    }

    const alert = await this.alertController.create({
      header: this.translocoService.translate('STREAK.exit.title'),
      message: this.translocoService.translate('STREAK.exit.message', {
        score: this.score,
      }),
      buttons: [
        {
          text: this.translocoService.translate('STREAK.exit.cancel'),
          role: 'cancel',
        },
        {
          text: this.translocoService.translate('STREAK.exit.confirm'),
          role: 'confirm',
          handler: () => {
            this.finishRun('quit', { silent: true });
            this.goToHome();
          },
        },
      ],
    });

    await alert.present();
  }
}
