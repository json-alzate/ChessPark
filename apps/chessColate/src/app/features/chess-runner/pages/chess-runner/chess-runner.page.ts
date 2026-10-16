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
  flame,
  heart,
  heartOutline,
  homeOutline,
  trophyOutline,
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
import {
  COOKIES_PER_HEART,
  difficultyForLevel,
  LEVELS_PER_WORLD,
  MAX_HEARTS,
  MAX_STRIKES,
  RunnerDifficulty,
  worldOfLevel,
} from '../../config/runner.config';
import { RunnerPiece, RunnerStats } from '../../models/runner.model';
import { RunnerPiecesService } from '../../services/runner-pieces.service';
import { RunnerPuzzleService } from '../../services/runner-puzzle.service';
import { RunnerRecordService } from '../../services/runner-record.service';
import { buildRunnerSequence, pieceKey } from '../../utils/runner-sequence.util';

/**
 * En qué punto está la pantalla:
 * - `loading`: buscando el ejercicio.
 * - `running`: la carrera.
 * - `puzzle`: el ejercicio en el tablero, con su reloj.
 * - `result`: se resolvió (y en un momento sigue sola la siguiente carrera), se falló o se acabó el tiempo.
 * - `gameover`: se acabó la partida (3 choques o 3 ejercicios fallidos): distancia y récord.
 * - `error`: el catálogo no respondió.
 */
type RunnerPageStatus = 'loading' | 'running' | 'puzzle' | 'result' | 'gameover' | 'error';

/** Cómo terminó el ejercicio. */
interface RunnerResult {
  kind: 'solved' | 'wrong' | 'timeout';
  puzzle: Puzzle;
}

/** Por qué se acabó la partida y cómo quedó. */
interface RunnerGameOver {
  reason: 'hits' | 'strikes';
  meters: number;
  record: number;
  newRecord: boolean;
  level: number;
  solved: number;
  cookies: number;
}

/** Qué dice el cartel de cada carrera bajo el nivel. */
export type RunnerBannerHint = 'first' | 'doubleJump' | 'faster' | 'world.sunset' | 'world.night' | 'world.dawn' | 'world.day';

/** Tiempo del ejercicio tras la carrera (la carrera no lo descuenta). */
const PUZZLE_TIMES = { total: 60, warningOn: 30, dangerOn: 15 } as const;
/** Pausa entre que Chocolate sale de la pantalla y aparece el tablero. */
const TRANSITION_MS = 450;
/** Cuánto se ve el tablero resuelto (con el confeti) antes de que arranque sola la siguiente carrera. */
const SOLVED_PAUSE_MS = 1600;
/** ELO de partida si no hay perfil. */
const DEFAULT_ELO = 1200;

/**
 * Chess Runner: un calentamiento antes de cada ejercicio. Chocolate corre y salta las piezas del
 * ejercicio como obstáculos (con un toque salta); al superarlas aparece el tablero y el reloj. No toca el ELO ni crea un
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
  private pieceSets = inject(RunnerPiecesService);
  private analytics = inject(AnalyticsService);
  private profileService = inject(ProfileService);
  private reminders = inject(TrainingReminderService);
  private sounds = inject(SoundsService);
  private confetti = inject(ConfettiService);
  private appService = inject(AppService);
  private records = inject(RunnerRecordService);
  private modalController = inject(ModalController);

  status: RunnerPageStatus = 'loading';

  /** El ejercicio de esta vuelta y las piezas de su carrera. */
  puzzle: Puzzle | null = null;
  sequence: RunnerPiece[] = [];
  progress: RunnerProgress = { cleared: 0, total: 0, stumbles: 0, combo: 0, meters: 0, cookies: 0 };
  /** Lo que se cuenta de la carrera que acaba de terminar. */
  runStats: RunnerStats | null = null;

  /** El ejercicio con su reloj, ya en el tablero. */
  puzzleToPlay: Puzzle | null = null;
  forceStopBoardTimer = false;
  result: RunnerResult | null = null;

  /** Ejercicios resueltos en esta partida. */
  solvedCount = 0;

  /** Corazones (uno por choque) y ejercicios fallidos de la partida. */
  hearts = MAX_HEARTS;
  strikes = 0;
  readonly heartSlots = Array.from({ length: MAX_HEARTS }, (_, i) => i);
  readonly maxStrikes = MAX_STRIKES;
  readonly cookiesPerHeart = COOKIES_PER_HEART;
  /** Metros de las carreras ya terminadas de la partida (la carrera en curso va aparte, en `progress`). */
  private baseMeters = 0;
  /** Galletas de toda la partida, y las que llevan hacia el próximo corazón. */
  cookiesTotal = 0;
  cookieStreak = 0;
  private runCookies = 0;
  private lastCookieSound = 0;
  /** El récord guardado y lo que dijo la última partida. */
  record = 0;
  gameOver: RunnerGameOver | null = null;
  /** Ya se explicó el doble salto en esta partida. */
  private taughtDoubleJump = false;
  /** Lo que dice el cartel de la carrera en curso. */
  bannerHint: RunnerBannerHint = 'first';

  /** Las piezas del set que el usuario eligió, como URLs para las miniaturas (hasta que carga, ninguna). */
  private pieceUrls: ReadonlyMap<string, string> = new Map();

  private played = new Set<string>();
  private prefetched: Promise<Puzzle | null> | null = null;
  private sessionStarted = false;
  private runStartedAt = 0;
  private transitionTimeout: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;

  constructor() {
    addIcons({
      closeOutline,
      eye,
      flame,
      heart,
      heartOutline,
      homeOutline,
      trophyOutline, playForwardOutline,
      playOutline,
      refreshOutline,
    });
  }

  /** Metros de la partida hasta ahora. */
  get meters(): number {
    return this.baseMeters + this.progress.meters;
  }

  /** El récord a mostrar: el guardado, o la distancia de esta partida si ya lo supera. */
  get bestMeters(): number {
    return Math.max(this.record, this.meters);
  }

  /** Nivel de la carrera: cada ejercicio resuelto sube uno, y con él la velocidad y el ritmo. */
  get level(): number {
    return this.solvedCount + 1;
  }

  /** La dificultad de la carrera que se muestra: congelada al empezarla, no cambia a mitad. */
  difficulty: RunnerDifficulty = difficultyForLevel(1);

  /** Color con el que juega el usuario: el FEN arranca con el turno del rival. */
  get playerColor(): 'white' | 'black' {
    return this.puzzleToPlay?.fen.split(' ')[1] === 'w' ? 'black' : 'white';
  }

  /** Miniatura de una pieza de la carrera, en el set elegido. */
  pieceUrl(piece: RunnerPiece): string | null {
    return this.pieceUrls.get(pieceKey(piece.kind, piece.color)) ?? null;
  }

  // ---------------------------------------------------------------- ciclo

  ionViewWillEnter(): void {
    this.played = new Set();
    this.prefetched = null;
    this.sessionStarted = false;
    this.resetGame();
    void this.loadNext();
  }

  /** Una partida nueva: todo a cero y los tres corazones. El récord, no. */
  private resetGame(): void {
    this.solvedCount = 0;
    this.hearts = MAX_HEARTS;
    this.strikes = 0;
    this.baseMeters = 0;
    this.cookiesTotal = 0;
    this.cookieStreak = 0;
    this.runCookies = 0;
    this.taughtDoubleJump = false;
    this.gameOver = null;
    this.record = this.records.best();
    this.progress = { cleared: 0, total: 0, stumbles: 0, combo: 0, meters: 0, cookies: 0 };
  }

  ionViewWillLeave(): void {
    this.stopEverything();
  }

  ngOnDestroy(): void {
    this.stopEverything();
  }

  private stopEverything(): void {
    // Lo corrido hasta aquí cuenta para el récord aunque se salga a media partida
    if (this.status !== 'gameover') {
      this.records.save(this.meters);
    }
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
    this.difficulty = difficultyForLevel(this.level);
    this.played.add(puzzle.uid);
    this.sequence = buildRunnerSequence(puzzle.fen, puzzle.uid, this.level);
    this.progress = { cleared: 0, total: this.sequence.length, stumbles: 0, combo: 0, meters: 0, cookies: 0 };
    this.runCookies = 0;

    if (this.sequence.length === 0) {
      // Un tablero sin piezas no tiene carrera: directo al ejercicio
      this.showPuzzle();
      return;
    }
    // Sin las piezas no hay carrera que dibujar: el lienzo avisa y se juega el ejercicio a secas
    this.pieceUrls = await this.pieceSets
      .load()
      .then((set) => set.urls)
      .catch(() => new Map<string, string>());
    if (generation !== this.generation) {
      return;
    }
    this.startRun();
  }

  private get userElo(): number {
    return this.profileService.getProfile?.elo ?? DEFAULT_ELO;
  }

  // ------------------------------------------------------------- la carrera

  /** Qué se le dice al jugador al empezar la carrera: lo nuevo que trae (el doble salto, un escenario) o, si no, que va más rápido. */
  private pickBannerHint(): RunnerBannerHint {
    if (this.level === 1) {
      return 'first';
    }
    if (!this.taughtDoubleJump && this.sequence.some((piece) => (piece.wall ?? 1) > 1)) {
      this.taughtDoubleJump = true;
      return 'doubleJump';
    }
    if ((this.level - 1) % LEVELS_PER_WORLD === 0) {
      return `world.${worldOfLevel(this.level)}`;
    }
    return 'faster';
  }

  private startRun(): void {
    this.bannerHint = this.pickBannerHint();
    this.status = 'running';
    this.runStartedAt = Date.now();
    if (!this.sessionStarted) {
      this.sessionStarted = true;
      // No molestar con el recordatorio en mitad de la sesión que empieza
      this.reminders.onSessionStarted();
    }
    void this.analytics.logEvent('chess_runner_started', { obstacles: this.sequence.length, level: this.level });
  }

  onRunnerEvent(name: RunnerEventName): void {
    switch (name) {
      case 'jump':
      case 'doubleJump':
        this.sounds.playSelect();
        break;
      case 'cookie':
        // Una fila de galletas son varias seguidas: no suena cada una
        if (Date.now() - this.lastCookieSound > 120) {
          this.lastCookieSound = Date.now();
          this.sounds.playCaptureSound();
        }
        break;
      case 'cleared':
        this.sounds.playMoveSound();
        break;
      case 'stumble':
        this.sounds.playError();
        // Un tirón en la mano refuerza el tropiezo donde el navegador lo permita (Android; iOS lo ignora)
        navigator.vibrate?.(60);
        this.loseHeart();
        break;
      case 'finishing':
        this.sounds.playGood();
        break;
      default:
        break;
    }
  }

  onRunnerProgress(progress: RunnerProgress): void {
    // Las galletas nuevas de esta carrera van sumando hacia el siguiente corazón
    const fresh = progress.cookies - this.runCookies;
    this.runCookies = progress.cookies;
    this.progress = progress;
    if (fresh > 0) {
      this.collectCookies(fresh);
    }
  }

  private collectCookies(count: number): void {
    this.cookiesTotal += count;
    this.cookieStreak += count;
    while (this.cookieStreak >= COOKIES_PER_HEART) {
      this.cookieStreak -= COOKIES_PER_HEART;
      if (this.hearts < MAX_HEARTS) {
        this.hearts++;
        this.sounds.playGood();
      }
    }
  }

  /** Un choque cuesta un corazón; sin ninguno, se acabó la partida. */
  private loseHeart(): void {
    if (this.status !== 'running') {
      return;
    }
    this.hearts = Math.max(0, this.hearts - 1);
    if (this.hearts === 0) {
      this.endGame('hits');
    }
  }

  onRunnerFinished(stats: RunnerStats): void {
    if (this.status !== 'running') {
      return;
    }
    this.runStats = stats;
    this.bankRun(stats.meters);
    void this.analytics.logEvent('chess_runner_finished', {
      obstacles: stats.total,
      stumbles: stats.stumbles,
      clean: stats.clean,
      duration_ms: stats.durationMs,
      meters: stats.meters,
      cookies: stats.cookies,
      hearts: this.hearts,
      best_combo: stats.bestCombo,
      level: this.level,
      skipped: false,
    });
    this.transitionTimeout = setTimeout(() => {
      this.transitionTimeout = null;
      this.showPuzzle();
    }, TRANSITION_MS);
  }

  /** Lo corrido en la carrera pasa a la cuenta de la partida y la carrera se pone a cero. */
  private bankRun(meters: number): void {
    this.baseMeters += meters;
    this.progress = { ...this.progress, meters: 0, cookies: 0 };
    this.runCookies = 0;
    this.records.save(this.baseMeters);
    this.record = this.records.best();
  }

  /** «Saltar carrera»: directo al ejercicio. */
  skipRun(): void {
    if (this.status !== 'running') {
      return;
    }
    this.bankRun(this.progress.meters);
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
    // Un ejercicio bien resuelto cura un choque
    this.hearts = Math.min(MAX_HEARTS, this.hearts + 1);
    this.finishPuzzle('solved', puzzle);
    this.confetti.launchTheme('gold');
    // Sin botón de por medio: tras el confeti arranca sola la siguiente carrera (el ejercicio ya está descargado)
    this.transitionTimeout = setTimeout(() => {
      this.transitionTimeout = null;
      void this.loadNext();
    }, SOLVED_PAUSE_MS);
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

  /** Se agotaron los ejercicios fallidos: lo que quede por ver es la solución y el final. */
  get outOfStrikes(): boolean {
    return this.strikes >= MAX_STRIKES;
  }

  private finishPuzzle(kind: RunnerResult['kind'], puzzle: Puzzle): void {
    if (kind !== 'solved') {
      this.strikes++;
    }
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
    const generation = this.generation;
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
    // Verla era lo único que quedaba por hacer con este ejercicio: al cerrarla (con el botón, la equis o fuera)
    // el juego sigue con la siguiente carrera, en vez de dejar el tablero parado en la misma posición
    await modal.onDidDismiss();
    if (generation === this.generation && this.status === 'result') {
      this.continueAfterFail();
    }
  }

  /** Tras un fallo: otra carrera, o el final si era el último ejercicio que se podía fallar. */
  private continueAfterFail(): void {
    if (this.outOfStrikes) {
      this.endGame('strikes');
    } else {
      void this.loadNext();
    }
  }

  /** Se acabó la partida: se guarda el récord y se enseña cómo quedó. */
  private endGame(reason: RunnerGameOver['reason']): void {
    const meters = this.meters;
    this.generation++;
    this.clearTransition();
    this.forceStopBoardTimer = true;
    const newRecord = this.records.save(meters);
    this.record = this.records.best();
    this.gameOver = {
      reason,
      meters,
      record: this.record,
      newRecord,
      level: this.level,
      solved: this.solvedCount,
      cookies: this.cookiesTotal,
    };
    this.puzzleToPlay = null;
    this.sequence = [];
    this.puzzle = null;
    this.result = null;
    this.status = 'gameover';
    void this.analytics.logEvent('chess_runner_game_over', {
      reason,
      meters,
      level: this.level,
      solved: this.solvedCount,
      cookies: this.cookiesTotal,
      new_record: newRecord,
    });
  }

  // ---------------------------------------------------------------- salidas

  retry(): void {
    void this.loadNext();
  }

  /** «Terminar la partida», tras el último fallo permitido. */
  finishGame(): void {
    if (this.status === 'result' && this.outOfStrikes) {
      this.endGame('strikes');
    }
  }

  /** «Jugar otra vez»: partida nueva desde el nivel 1. */
  playAgain(): void {
    this.resetGame();
    this.sessionStarted = false;
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
