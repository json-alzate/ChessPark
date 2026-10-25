import { Component, inject, OnDestroy, isDevMode } from '@angular/core';
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
  checkmarkCircle,
  closeOutline,
  bulbOutline,
  flaskOutline,
  eye,
  flagOutline,
  flame,
  heart,
  heartOutline,
  homeOutline,
  trophyOutline,
  playForwardOutline,
  playOutline,
  refreshOutline,
  skullOutline,
  star,
  starOutline,
  timerOutline,
  trendingDown,
  trendingUp,
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

import { RunnerLessonComponent } from '../../components/runner-lesson/runner-lesson.component';
import { RunnerLessonModalComponent } from '../../components/runner-lesson-modal/runner-lesson-modal.component';
import { RunnerCard, RunnerCardComponent } from '../../components/runner-card/runner-card.component';
import { RunnerGameOver, RunnerGameOverComponent } from '../../components/runner-game-over/runner-game-over.component';
import { RunnerStoryComponent } from '../../components/runner-story/runner-story.component';
import { epilogueScene, guardianOf, introScene, prologue, StoryScene, victoryScene } from '../../story/story-scenes';
import { lessonFor, RunnerLesson } from '../../lessons/runner-lessons.data';
import {
  RunnerCanvasComponent,
  RunnerEventName,
  RunnerProgress,
} from '../../components/runner-canvas/runner-canvas.component';
import { CampaignEvent, CampaignStep, RunnerCampaign } from '../../campaign/runner-campaign.model';
import { nextBeat, seenKeys } from '../../campaign/runner-beats.util';
import { BLOCK_SIZE, CHAPTERS, RunnerWorld } from '../../campaign/runner-curriculum';
import { DOG_SKINS, skinPreviewUrl } from '../../rendering/dog-skins';
import { RunnerSpritesService } from '../../services/runner-sprites.service';
import {
  COOKIES_PER_HEART,
  difficultyForLevel,
  MAX_STRIKES,
  RunnerDifficulty,
} from '../../config/runner.config';
import { RunnerModifiers } from '../../config/runner-powers';
import { RunnerGame } from '../../game/runner-game';
import { Mission, missionDone, missionFailed, missionFor, MissionProgress, missionValue } from '../../game/runner-missions';
import { RunnerSession } from '../../game/runner-session';
import { RunnerPiece, RunnerStats } from '../../models/runner.model';
import { RunnerPiecesService } from '../../services/runner-pieces.service';
import { RunnerPuzzleService } from '../../services/runner-puzzle.service';
import { RunnerRecordService } from '../../services/runner-record.service';
import { buildRunnerSequence, pieceKey } from '../../utils/runner-sequence.util';

/**
 * En qué punto está la pantalla:
 * - `loading`: buscando el ejercicio.
 * - `story`: una escena de la historia, sin palabras (el prólogo, llegar a un mundo, vencer al guardián, el final).
 * - `lesson`: la lección del patrón (un tablero pequeño con frases cortas), la primera vez que se entrena.
 * - `card`: una tarjeta entre escenas: el camino hasta el frasco (tras el prólogo) o el poder que se acaba de ganar.
 * - `running`: la carrera.
 * - `puzzle`: el ejercicio en el tablero, con su reloj.
 * - `result`: se resolvió (y en un momento sigue sola la siguiente carrera), se falló o se acabó el tiempo.
 * - `gameover`: se acabó la partida (3 choques o 3 ejercicios fallidos): distancia y récord.
 * - `error`: el catálogo no respondió.
 */
type RunnerPageStatus = 'loading' | 'story' | 'lesson' | 'card' | 'running' | 'puzzle' | 'result' | 'gameover' | 'error';


/** Cómo terminó el ejercicio. */
interface RunnerResult {
  kind: 'solved' | 'wrong' | 'timeout';
  puzzle: Puzzle;
}

/** Un capítulo que se acaba de completar: lo que se ve al resolver el último ejercicio de su bloque. */
interface RunnerChapterDone {
  theme: string;
  stars: number;
}

/** Qué dice el cartel de cada carrera bajo el nombre del patrón: nada, cómo se juega, lo nuevo o que es un repaso. */
export type RunnerBannerHint = 'none' | 'first' | 'review' | 'boss';

/** Tiempo del ejercicio tras la carrera (la carrera no lo descuenta). */
const PUZZLE_TIMES = { total: 60, warningOn: 30, dangerOn: 15 } as const;
/** Pausa entre que el perrito sale de la pantalla y aparece el tablero. */
const TRANSITION_MS = 450;
/** Cuánto se ve el tablero resuelto (con el confeti) antes de que arranque sola la siguiente carrera. */
const SOLVED_PAUSE_MS = 1600;
/** Lo mismo cuando el ejercicio cierra un capítulo. */
const CHAPTER_PAUSE_MS = 2400;
/** Cuánto se queda a la vista el aviso del doble salto. */
const WALL_HINT_MS = 2800;
const EMPTY_PROGRESS: RunnerProgress = { cleared: 0, total: 0, stumbles: 0, combo: 0, meters: 0, cookies: 0, perfects: 0, bestCombo: 0, stars: 0 };
/** El ELO de la barra tarda ~0,7 s en llegar al valor nuevo. */
const RATING_STEPS = 14;
const RATING_STEP_MS = 50;
/** Lo que sube el nivel de la carrera contra un guardián: más rápida y con más piezas encadenadas. */
const BOSS_LEVEL_BUMP = 2;
/** Cuánto se ve el aviso de que se ha batido el récord. */
const RECORD_BANNER_MS = 2600;
/** ELO de partida si no hay perfil. */
const DEFAULT_ELO = 1200;

/**
 * Chess Runner: un calentamiento antes de cada ejercicio. El perrito corre y salta las piezas del
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
    RunnerLessonComponent,
    RunnerStoryComponent,
    RunnerCardComponent,
    RunnerGameOverComponent,
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
  private spritesService = inject(RunnerSpritesService);

  status: RunnerPageStatus = 'loading';

  /** Solo en desarrollo (`ng serve`): un atajo al laboratorio de la manada. En producción no se ve. */
  readonly devTools = isDevMode();

  /** El ejercicio de esta vuelta y las piezas de su carrera. */
  puzzle: Puzzle | null = null;
  sequence: RunnerPiece[] = [];
  progress: RunnerProgress = { ...EMPTY_PROGRESS };
  /** Lo que se cuenta de la carrera que acaba de terminar. */
  runStats: RunnerStats | null = null;

  /** El ejercicio con su reloj, ya en el tablero. */
  puzzleToPlay: Puzzle | null = null;
  forceStopBoardTimer = false;
  result: RunnerResult | null = null;

  /** Todo lo que se lleva del jugador: la campaña, la partida en curso, los poderes y el récord. */
  private game = new RunnerGame(this.records);
  /** El mundo de la carrera en curso (el tono del escenario). */
  world: RunnerWorld = 'day';
  /** La escena de la historia que se está viendo, si toca. */
  scene: StoryScene | null = null;
  /** Qué hacer cuando acabe la escena. */
  private afterScene: (() => void) | null = null;
  /** La tarjeta que se enseña (el camino o un poder nuevo) y qué hacer al cerrarla. */
  card: RunnerCard | null = null;
  private afterCard: (() => void) | null = null;
  /** La lección que se está enseñando, si toca. */
  lesson: RunnerLesson | null = null;
  /** Si el ejercicio resuelto cerró un capítulo. */
  chapterDone: RunnerChapterDone | null = null;
  /** Cuánto cambió el ELO del perrito con el último ejercicio (para enseñarlo al resolverlo o fallarlo). */
  ratingChange: { from: number; to: number } | null = null;

  /** La campaña, la partida y las reglas con los poderes (de `RunnerGame`). */
  get campaign(): RunnerCampaign {
    return this.game.campaign;
  }
  get session(): RunnerSession {
    return this.game.session;
  }
  get mods(): RunnerModifiers {
    return this.game.mods;
  }
  /** El récord guardado. */
  get record(): number {
    return this.game.record;
  }

  /** Un hueco por corazón posible (crece con el poder del corazón). */
  get heartSlots(): number[] {
    return Array.from({ length: this.session.rules.maxHearts }, (_, i) => i);
  }
  readonly maxStrikes = MAX_STRIKES;
  readonly chapterCount = CHAPTERS.length;
  readonly cookiesPerHeart = COOKIES_PER_HEART;
  private runCookies = 0;
  private lastCookieSound = 0;
  /** Lo que dijo la última partida. */
  gameOver: RunnerGameOver | null = null;
  /** En qué pieza de la carrera sale el aviso del doble salto (la anterior a la primera falange), si toca. */
  private wallHintAt: number | null = null;
  /** El aviso del doble salto está a la vista. */
  wallHintVisible = false;
  /** Se acaba de pasar el récord de distancia: el aviso está a la vista (una vez por partida). */
  recordBannerVisible = false;
  private recordBeaten = false;
  private recordTimeout: ReturnType<typeof setTimeout> | null = null;
  private wallHintTimeout: ReturnType<typeof setTimeout> | null = null;
  /** La misión de la carrera en curso, cómo va y los segundos que ganó para el ejercicio. */
  mission: Mission | null = null;
  missionState: 'active' | 'done' | 'failed' = 'active';
  private missionBonus = 0;

  /** Segundos de más que tiene el ejercicio del tablero por haber cumplido la misión. */
  get timeBonus(): number {
    return this.puzzleToPlay && this.puzzleToPlay.times ? this.puzzleToPlay.times.total - PUZZLE_TIMES.total : 0;
  }

  /** Lo que lleva la misión (para enseñar «2/3»). */
  get missionCurrent(): number {
    return this.mission ? missionValue(this.mission, this.missionProgress()) : 0;
  }

  /** Lo que cuenta la carrera para la misión (las estadísticas finales, si ya se tienen). */
  private missionProgress(stats: RunnerStats | null = null): MissionProgress {
    return {
      perfects: stats?.perfects ?? this.progress.perfects,
      cookies: stats?.cookies ?? this.progress.cookies,
      bestCombo: stats?.bestCombo ?? this.progress.bestCombo,
      stars: this.progress.stars,
      stumbles: stats?.stumbles ?? this.progress.stumbles,
    };
  }

  /** Mira si la misión se cumplió (o ya no puede cumplirse) con lo que lleva la carrera. */
  private checkMission(stats: RunnerStats | null = null): void {
    if (!this.mission || this.missionState !== 'active') {
      return;
    }
    const progress = this.missionProgress(stats);
    if (missionDone(this.mission, progress, stats !== null)) {
      this.missionState = 'done';
      this.missionBonus = this.mission.reward;
      this.sounds.playCheckSound();
      navigator.vibrate?.(20);
    } else if (missionFailed(this.mission, progress)) {
      this.missionState = 'failed';
    }
  }

  /** La lección que se está enseñando antes de la carrera ya acabó de contarse. */
  lessonDone = false;
  /** Lo que dice el cartel de la carrera en curso. */
  bannerHint: RunnerBannerHint = 'none';

  /** Las piezas del set que el usuario eligió, como URLs para las miniaturas (hasta que carga, ninguna). */
  private pieceUrls: ReadonlyMap<string, string> = new Map();

  private played = new Set<string>();
  /** El ejercicio siguiente ya pedido, y para qué paso de la campaña se pidió. */
  private prefetched: { key: string; promise: Promise<Puzzle | null> } | null = null;
  private sessionStarted = false;
  private runStartedAt = 0;
  private transitionTimeout: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;

  constructor() {
    addIcons({
      checkmarkCircle,
      closeOutline,
      bulbOutline,
      flaskOutline,
      eye,
      flagOutline,
      flame,
      heart,
      heartOutline,
      homeOutline,
      trophyOutline, playForwardOutline,
      playOutline,
      refreshOutline,
      skullOutline,
      star,
      starOutline,
      timerOutline,
      trendingDown,
      trendingUp,
    });
  }

  // Lo de la partida, tal cual lo lleva la sesión
  get hearts(): number {
    return this.session.hearts;
  }
  get strikes(): number {
    return this.session.strikes;
  }
  get cookiesTotal(): number {
    return this.session.cookies;
  }
  get cookieStreak(): number {
    return this.session.cookieStreak;
  }
  get solvedCount(): number {
    return this.session.solved;
  }
  /** Se agotaron los ejercicios fallidos: lo que quede por ver es la solución y el final. */
  get outOfStrikes(): boolean {
    return this.session.outOfStrikes;
  }

  /** Metros de la partida hasta ahora. */
  get meters(): number {
    return this.session.meters + this.progress.meters;
  }

  /** El récord a mostrar: el guardado, o la distancia de esta partida si ya lo supera. */
  get bestMeters(): number {
    return Math.max(this.record, this.meters);
  }

  /** Qué toca jugar: el patrón, el puesto dentro de su bloque y lo difícil que es. */
  get step(): CampaignStep {
    return this.game.step;
  }

  /** Los nombres de los patrones de los capítulos, en el idioma de la app. */
  get chapterNames(): string[] {
    return CHAPTERS.map((chapter) => this.appService.getNameThemePuzzleByValue(chapter.theme));
  }

  /** Las imágenes del perrito con cada pelaje, para el armario (hasta que cargan, ninguna). */
  skinPreviews: ReadonlyMap<string, string> = new Map();

  /** Los pelajes con su estado (puesto, desbloqueado, comprable o por ganar). */
  get wardrobe() {
    return this.game.wardrobe;
  }

  /** Compra un pelaje con las galletas guardadas y se lo pone. */
  buySkin(id: string): void {
    if (this.game.buy(id)) {
      this.sounds.playGood();
      void this.analytics.logEvent('chess_runner_skin', { skin: id, action: 'buy' });
    }
  }

  /** Se pone un pelaje que ya tiene. */
  wearSkin(id: string): void {
    this.game.select(id);
  }

  private async loadSkinPreviews(): Promise<void> {
    try {
      const sprites = await this.spritesService.load();
      this.skinPreviews = new Map(DOG_SKINS.map((skin) => [skin.id, skinPreviewUrl(sprites, skin.id)]));
    } catch {
      // Sin vistas previas las tarjetas enseñan solo el color
    }
  }

  /** Días seguidos jugando que siguen vivos. */
  get dayStreak(): number {
    return this.game.dayStreak;
  }

  /** El pelaje del perrito y las galletas guardadas para comprar otros. */
  get skin(): string {
    return this.game.skin;
  }
  get wallet(): number {
    return this.game.wallet;
  }

  /** El ELO que se enseña en la barra: cuenta del anterior al nuevo en un momento, para que el cambio se note. */
  shownRating = 0;
  private ratingTimer: ReturnType<typeof setInterval> | null = null;

  private animateRating(): void {
    this.stopRatingAnimation();
    const change = this.ratingChange;
    if (!change) {
      this.shownRating = this.game.rating;
      return;
    }
    let step = 0;
    this.shownRating = change.from;
    this.ratingTimer = setInterval(() => {
      step++;
      this.shownRating = Math.round(change.from + ((change.to - change.from) * Math.min(step, RATING_STEPS)) / RATING_STEPS);
      if (step >= RATING_STEPS) {
        this.stopRatingAnimation();
      }
    }, RATING_STEP_MS);
  }

  private stopRatingAnimation(): void {
    if (this.ratingTimer) {
      clearInterval(this.ratingTimer);
      this.ratingTimer = null;
    }
  }

  /** El ELO del perrito en el runner. */
  get rating(): number {
    return this.game.rating;
  }

  /** El ELO del ejercicio que se está jugando (el del guardián, si lo es). */
  get puzzleRating(): number {
    return this.puzzle?.rating ?? 0;
  }

  /** El paso de la campaña al que pertenece el ejercicio que está en el tablero (la campaña ya pudo avanzar al resolverlo). */
  private puzzleStep: CampaignStep | null = null;

  /** El patrón del ejercicio que está en el tablero, aunque al resolverlo la campaña ya apunte al siguiente. */
  get puzzlePatternName(): string {
    return this.appService.getNameThemePuzzleByValue((this.puzzleStep ?? this.step).theme);
  }

  /** Los puntos del bloque en el tablero: los ejercicios ya resueltos de ese paso (con este, si se acaba de resolver). */
  get puzzleDone(): number {
    const step = this.puzzleStep ?? this.step;
    return step.index + (this.result?.kind === 'solved' ? 1 : 0);
  }

  /** El ejercicio del tablero es el del guardián. */
  get puzzleBoss(): boolean {
    const step = this.puzzleStep ?? this.step;
    return step.kind === 'block' && step.index === BLOCK_SIZE - 1;
  }

  /** Los puntos del bloque del ejercicio que está en el tablero. */
  get puzzleSlots(): number[] {
    return Array.from({ length: (this.puzzleStep ?? this.step).total }, (_, i) => i);
  }

  /** El nombre del patrón que se entrena, en el idioma de la app. */
  get patternName(): string {
    return this.appService.getNameThemePuzzleByValue(this.step.theme);
  }

  /** Lo que lleva hecho de la carrera, de 0 a 100. */
  get progressPercent(): number {
    const { cleared, total } = this.progress;
    return total > 0 ? Math.min(100, Math.round((cleared / total) * 100)) : 0;
  }

  /** Dónde cae, en la barra, el respiro de cada oleada. */
  get waveMarks(): number[] {
    const total = this.sequence.length;
    return this.sequence.flatMap((piece, index) => ((piece.rest ?? 0) > 0 ? [Math.round(((index + 1) / total) * 100)] : []));
  }

  /** La pieza del jefe, si esta carrera es la del último ejercicio del capítulo (el que lo cierra); si no, `null`. */
  get bossKey(): string | null {
    const { step } = this;
    return step.kind === 'block' && step.index === BLOCK_SIZE - 1 ? guardianOf(step.chapter) : null;
  }

  /** Un punto por ejercicio del bloque o del repaso. */
  get blockSlots(): number[] {
    return Array.from({ length: this.step.total }, (_, i) => i);
  }

  /** Nivel de la carrera: el capítulo en que se va. Con él suben la velocidad y el ritmo. */
  get level(): number {
    return this.game.level;
  }

  /** La dificultad de la carrera que se muestra: congelada al empezarla, no cambia a mitad. */
  difficulty: RunnerDifficulty = difficultyForLevel(1);

  /** Color con el que juega el usuario: el FEN arranca con el turno del rival. */
  get playerColor(): 'white' | 'black' {
    return this.puzzleToPlay?.fen.split(' ')[1] === 'w' ? 'black' : 'white';
  }

  /** Las piezas del set del usuario como imágenes, por clave (`bp`, `bk`…), para el mapa. */
  get pieceImages(): ReadonlyMap<string, string> {
    return this.pieceUrls;
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
    // El progreso de la campaña se lee de nuevo cada vez: lo que se guardó es lo que manda
    this.game.enter(this.userElo);
    this.stopRatingAnimation();
    this.shownRating = this.game.rating;
    this.resetScreen();
    // Quien ya jugó vuelve al panel (su camino, sus poderes, el armario) y empieza cuando quiere; la primera vez va directo al juego
    if (this.campaign.puzzles > 0) {
      this.showLobby();
    } else {
      void this.loadNext();
    }
  }

  /** Las piezas del set del usuario, como imágenes para el logo y el camino; sin ellas, esas imágenes quedan vacías. */
  private async loadPieces(): Promise<void> {
    this.pieceUrls = await this.pieceSets
      .load()
      .then((set) => set.urls)
      .catch(() => new Map<string, string>());
  }

  /** El panel al entrar: lo mismo que al acabar una partida, pero sin partida a medias y con «Jugar». */
  private showLobby(): void {
    this.gameOver = {
      reason: 'lobby',
      meters: 0,
      record: this.record,
      newRecord: false,
      chapter: this.campaign.chapter + 1,
      round: this.campaign.round + 1,
      rating: this.game.rating,
      ratingGain: 0,
      solved: 0,
      cookies: 0,
    };
    void this.loadPieces();
    void this.loadSkinPreviews();
    this.status = 'gameover';
  }

  /** La pantalla de una partida nueva: sin cuentas de la carrera anterior ni avisos. */
  private resetScreen(): void {
    this.runCookies = 0;
    this.wallHintAt = null;
    this.wallHintVisible = false;
    this.recordBeaten = false;
    this.recordBannerVisible = false;
    this.gameOver = null;
    this.chapterDone = null;
    this.progress = { ...EMPTY_PROGRESS };
  }

  ionViewWillLeave(): void {
    this.stopEverything();
  }

  ngOnDestroy(): void {
    this.stopEverything();
  }

  private stopEverything(): void {
    this.stopRatingAnimation();
    // Lo corrido hasta aquí cuenta para el récord aunque se salga a media partida
    if (this.status !== 'gameover') {
      this.game.saveRecord(this.meters);
    }
    // Una carga que llegue tarde no debe pintar nada en una pantalla que ya se fue
    this.generation++;
    this.clearTransition();
    this.scene = null;
    this.afterScene = null;
    this.clearWallHint();
    this.forceStopBoardTimer = true;
    this.puzzleToPlay = null;
    this.sequence = [];
    this.puzzle = null;
  }

  /** Busca el siguiente ejercicio y arma su carrera. */
  async loadNext(): Promise<void> {
    const generation = ++this.generation;
    this.clearTransition();
    this.scene = null;
    this.afterScene = null;
    this.status = 'loading';
    this.result = null;
    this.puzzleToPlay = null;
    this.forceStopBoardTimer = false;
    this.runStats = null;

    const step = this.step;
    const elo = this.game.targetRating;
    const pending = this.prefetched;
    this.prefetched = null;
    // La precarga vale si se pidió para este mismo paso y ELO (si se falló en vez de acertar, el siguiente cambia).
    // Si no trajo nada (un fallo de red pasajero) se vuelve a intentar antes de dar error
    const puzzle =
      (pending && pending.key === this.stepKey(step.theme, elo) ? await pending.promise : null) ??
      (await this.fetchFor(step, elo));

    // Se salió de la pantalla (o se pidió otro) mientras bajaba
    if (generation !== this.generation) {
      return;
    }
    if (!puzzle) {
      this.status = 'error';
      return;
    }

    this.puzzle = puzzle;
    this.puzzleStep = step;
    this.world = this.game.world;
    // Dentro de un capítulo la dificultad sube con cada ejercicio resuelto del bloque
    // El guardián (el último ejercicio del capítulo) pone la carrera más dura: un poco más rápida y con más piezas seguidas
    const bossBump = this.bossKey ? BOSS_LEVEL_BUMP : 0;
    this.difficulty = difficultyForLevel(this.level + (step.kind === 'block' ? step.index * 0.18 : 0) + bossBump);
    this.played.add(puzzle.uid);
    this.sequence = buildRunnerSequence(puzzle.fen, puzzle.uid, this.level + bossBump);
    this.progress = { ...EMPTY_PROGRESS, total: this.sequence.length };
    this.runCookies = 0;

    if (this.sequence.length === 0) {
      // Un tablero sin piezas no tiene carrera: directo al ejercicio
      this.showPuzzle();
      return;
    }
    // Sin las piezas no hay carrera que dibujar: el lienzo avisa y se juega el ejercicio a secas
    await this.loadPieces();
    if (generation !== this.generation) {
      return;
    }
    if (this.beforeRun(step)) {
      return;
    }
    this.startRun();
  }

  /**
   * Antes de correr, lo que toque enseñar: el prólogo, la llegada al mundo o la lección del patrón (cada cosa, una vez).
   * Devuelve `true` si ha empezado alguna; al acabar vuelve a preguntar hasta que ya no toca nada.
   */
  private beforeRun(step: CampaignStep): boolean {
    const beat = nextBeat(this.campaign, step, lessonFor(step.theme) !== null);
    if (!beat) {
      return false;
    }
    this.game.see(...beat.seen);
    if (beat.kind === 'lesson') {
      this.lesson = lessonFor(beat.theme);
      this.status = 'lesson';
    } else {
      const next = () => {
        if (!this.beforeRun(step)) {
          this.startRun();
        }
      };
      // Tras el prólogo, el camino entero: qué hay que recorrer para recuperar el frasco
      this.playScene(beat.kind === 'prologue' ? prologue : introScene(beat.chapter), beat.kind === 'prologue' ? () => this.showCard({ kind: 'journey' }, next) : next);
    }
    return true;
  }

  /** Enseña una tarjeta y, al cerrarla, hace `then`. */
  private showCard(card: RunnerCard, then: () => void): void {
    this.card = card;
    this.afterCard = then;
    this.status = 'card';
  }

  /** «Seguir» en una tarjeta. */
  closeCard(): void {
    if (this.status !== 'card' || !this.afterCard) {
      return;
    }
    const then = this.afterCard;
    this.afterCard = null;
    this.card = null;
    then();
  }

  /** Enseña una escena de la historia y, al acabar (o al saltarla), hace `then`. */
  private playScene(scene: StoryScene, then: () => void): void {
    this.scene = scene;
    this.afterScene = then;
    this.status = 'story';
  }

  /** La escena acabó sola. */
  onStoryFinished(): void {
    this.endScene();
  }

  /** Tocar la escena (o su botón) la salta. */
  skipStory(): void {
    this.endScene();
  }

  /** Sin dibujos que enseñar no hay escena: se sigue. */
  onStoryFailed(): void {
    this.endScene();
  }

  private endScene(): void {
    if (this.status !== 'story' || !this.afterScene) {
      return;
    }
    const then = this.afterScene;
    this.afterScene = null;
    this.scene = null;
    then();
  }

  /** La lección acabó: se queda a la vista (con su consejo) y el botón «Empezar» llama la atención; no hay prisa por leerla. */
  onLessonFinished(): void {
    if (this.status === 'lesson') {
      this.lessonDone = true;
    }
  }

  /** «Empezar»: directo a la carrera. */
  skipLesson(): void {
    if (this.status !== 'lesson') {
      return;
    }
    this.clearTransition();
    this.lesson = null;
    this.lessonDone = false;
    if (!this.beforeRun(this.step)) {
      this.startRun();
    }
  }

  /** Sin piezas que dibujar no hay lección: se sigue con la carrera. */
  onLessonFailed(): void {
    this.skipLesson();
  }

  private get userElo(): number {
    return this.profileService.getProfile?.elo ?? DEFAULT_ELO;
  }

  /** Para qué se pide una precarga: el patrón y el ELO. */
  private stepKey(theme: string, elo: number): string {
    return `${theme}|${elo}`;
  }

  /** Pide por adelantado el ejercicio que se espera (por defecto, el que toca ahora en la campaña). */
  private prefetchNext(next: { step: CampaignStep; elo: number } = { step: this.step, elo: this.game.targetRating }): void {
    this.prefetched = { key: this.stepKey(next.step.theme, next.elo), promise: this.fetchFor(next.step, next.elo) };
  }

  private fetchFor(step: CampaignStep, elo: number): Promise<Puzzle | null> {
    return this.puzzles.next(elo, this.played, Math.random, step.theme);
  }

  // ------------------------------------------------------------- la carrera

  /** Qué se le dice al jugador al empezar la carrera: cómo se juega la primera vez o que es un repaso. */
  private pickBannerHint(): RunnerBannerHint {
    const { step, campaign } = this;
    if (step.kind === 'review') {
      return 'review';
    }
    if (this.bossKey) {
      return 'boss';
    }
    if (campaign.puzzles === 0) {
      return 'first';
    }
    return 'none';
  }

  /**
   * El doble salto se explica justo antes de la primera falange (no al empezar la carrera, que queda lejos): se anota en qué
   * pieza saltará el aviso, y solo la primera vez que se encuentra una.
   */
  private planWallHint(): void {
    this.wallHintAt = null;
    this.wallHintVisible = false;
    const firstWall = this.sequence.findIndex((piece) => (piece.wall ?? 1) > 1);
    if (firstWall > 0 && !this.game.hasSeen(seenKeys.doubleJumpHint)) {
      this.wallHintAt = firstWall - 1;
    }
  }

  private showRecordBanner(): void {
    this.recordBeaten = true;
    this.recordBannerVisible = true;
    this.sounds.playCheckmateSound();
    navigator.vibrate?.([30, 40, 30]);
    this.recordTimeout = setTimeout(() => {
      this.recordTimeout = null;
      this.recordBannerVisible = false;
    }, RECORD_BANNER_MS);
  }

  /** Sale el aviso del doble salto un momento y se da por visto. */
  private showWallHint(): void {
    this.wallHintAt = null;
    this.wallHintVisible = true;
    this.game.see(seenKeys.doubleJumpHint);
    this.wallHintTimeout = setTimeout(() => {
      this.wallHintTimeout = null;
      this.wallHintVisible = false;
    }, WALL_HINT_MS);
  }

  private startRun(): void {
    this.mission = this.puzzle ? missionFor(this.puzzle.uid, this.level) : null;
    this.missionState = 'active';
    this.missionBonus = 0;
    this.bannerHint = this.pickBannerHint();
    this.planWallHint();
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
        // Parte de las galletas que se llevaban hacia el próximo corazón salen volando
        this.session.scatterCookies();
        this.loseHeart();
        break;
      case 'perfect':
        this.sounds.playGood();
        break;
      case 'star':
        this.sounds.playCheckSound();
        navigator.vibrate?.(25);
        break;
      case 'smash':
        this.sounds.playCaptureSound();
        break;
      case 'shield':
        this.sounds.playCheckSound();
        navigator.vibrate?.(30);
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
      this.game.earn(fresh);
    }
    if (this.wallHintAt !== null && progress.cleared >= this.wallHintAt && this.status === 'running') {
      this.showWallHint();
    }
    this.checkMission();
    // Pasar el récord de distancia (el de antes de esta partida) se celebra una vez
    if (!this.recordBeaten && this.record > 0 && this.meters > this.record && this.status === 'running') {
      this.showRecordBanner();
    }
  }

  private collectCookies(count: number): void {
    if (this.session.addCookies(count) > 0) {
      this.sounds.playGood();
    }
  }

  /** Un choque cuesta un corazón; sin ninguno, se acabó la partida. */
  private loseHeart(): void {
    if (this.status === 'running' && this.session.loseHeart()) {
      this.endGame('hits');
    }
  }

  onRunnerFinished(stats: RunnerStats): void {
    if (this.status !== 'running') {
      return;
    }
    this.runStats = stats;
    this.checkMission(stats);
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
    this.game.bank(meters);
    this.progress = { ...this.progress, meters: 0, cookies: 0 };
    this.runCookies = 0;
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
    // Cumplir la misión de la carrera da tiempo extra para el ejercicio
    this.puzzleToPlay = { ...this.puzzle, times: { ...PUZZLE_TIMES, total: PUZZLE_TIMES.total + this.missionBonus } };
    this.status = 'puzzle';

    void this.analytics.logEvent('puzzle_started', {
      routine_kind: 'runner',
      routine_minutes: 0,
      theme: this.puzzle.themes?.[0] ?? '',
      puzzle_elo: this.puzzle.rating ?? 0,
    });
    // Mientras se resuelve este, se baja el siguiente (contando con que se acierte) para que la espera sea mínima
    this.prefetchNext(this.game.after(true, this.puzzle.rating));
  }

  onPuzzleSolved(puzzle: Puzzle): void {
    if (this.status !== 'puzzle') {
      return;
    }
    this.sounds.playGood();
    // Un ejercicio bien resuelto cura un choque y avanza el bloque; si cierra un capítulo, el perrito gana su poder
    const closing = this.step;
    const events = this.game.recordSolved(puzzle.rating);
    const done = events.find((event) => event.kind === 'chapterComplete');
    this.chapterDone = done?.kind === 'chapterComplete' ? { theme: closing.theme, stars: done.stars } : null;
    this.ratingChange = this.ratingChangeOf(events);
    this.animateRating();
    this.finishPuzzle('solved', puzzle);
    this.confetti.launchTheme('gold');
    const chapter = events.find((event) => event.kind === 'chapterComplete');
    // Sin botón de por medio: tras el confeti arranca sola la siguiente carrera (el ejercicio ya está descargado).
    // Si se cerró un capítulo, el tablero se deja ver algo más (es el momento de saborearlo) y sigue la escena de victoria
    this.transitionTimeout = setTimeout(() => {
      this.transitionTimeout = null;
      if (chapter?.kind === 'chapterComplete') {
        this.playVictory(chapter, events.some((event) => event.kind === 'roundComplete' && event.round === 0));
      } else {
        void this.loadNext();
      }
    }, chapter ? CHAPTER_PAUSE_MS : SOLVED_PAUSE_MS);
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

  /** Lo que cambió el ELO del perrito con el último ejercicio, para enseñarlo; `null` si no cambió. */
  private ratingChangeOf(events: CampaignEvent[]): { from: number; to: number } | null {
    const change = events.find((event) => event.kind === 'rating');
    return change?.kind === 'rating' ? { from: change.from, to: change.to } : null;
  }

  /** El guardián cae y el perrito gana su poder; si era el último capítulo, además llega el final de la historia. */
  private playVictory(done: Extract<CampaignEvent, { kind: 'chapterComplete' }>, campaignComplete: boolean): void {
    const gearBefore = this.campaign.powers.filter((power) => power !== done.power);
    // Una fanfarria para el momento: el guardián cae y llega el poder
    this.sounds.playCheckmateSound();
    const afterwards = () => {
      if (campaignComplete && !this.game.hasSeen(seenKeys.epilogue)) {
        this.game.see(seenKeys.epilogue);
        this.sounds.playCheckmateSound();
        this.playScene(epilogueScene(this.campaign.powers), () => void this.loadNext());
      } else {
        void this.loadNext();
      }
    };
    this.playScene(victoryScene({ chapter: done.chapter, stars: done.stars, power: done.power, gearBefore }), () => {
      // El poder nuevo se explica: qué es y qué cambia en la carrera
      if (done.power && done.firstTime) {
        this.showCard({ kind: 'power', power: done.power }, afterwards);
      } else {
        afterwards();
      }
    });
  }

  private finishPuzzle(kind: RunnerResult['kind'], puzzle: Puzzle): void {
    if (kind !== 'solved') {
      this.ratingChange = this.ratingChangeOf(this.game.recordFailed(puzzle.rating));
      this.animateRating();
      this.chapterDone = null;
      // Tras un fallo el siguiente es del mismo patrón pero más fácil: se pide ya, mientras se mira la solución
      this.prefetchNext();
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

  /** ¿Hay lección de este patrón que volver a ver? */
  get hasPatternLesson(): boolean {
    return lessonFor(this.step.theme) !== null;
  }

  /** «Ver el patrón»: la lección animada del patrón que se entrena, en una ventana, tras fallar un ejercicio. */
  async showPatternLesson(): Promise<void> {
    const lesson = lessonFor(this.step.theme);
    if (!lesson) {
      return;
    }
    const modal = await this.modalController.create({
      component: RunnerLessonModalComponent,
      cssClass: 'runner-lesson-modal',
      componentProps: { lesson, title: this.patternName },
    });
    await modal.present();
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
    const newRecord = this.game.saveRecord(meters);
    this.gameOver = {
      reason,
      meters,
      record: this.record,
      newRecord,
      chapter: this.campaign.chapter + 1,
      round: this.campaign.round + 1,
      rating: this.game.rating,
      ratingGain: this.game.ratingGain,
      solved: this.solvedCount,
      cookies: this.cookiesTotal,
    };
    void this.loadPieces();
    void this.loadSkinPreviews();
    this.chapterDone = null;
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

  /** «Jugar otra vez»: partida nueva; la campaña sigue donde iba. */
  playAgain(): void {
    this.game.newMatch();
    this.resetScreen();
    this.sessionStarted = false;
    void this.loadNext();
  }

  /** La equis de la barra: a mitad de partida lleva al panel (con lo corrido guardado); desde el panel, al inicio. */
  exit(): void {
    if (this.status === 'gameover' || this.status === 'error') {
      this.goToHome();
    } else {
      this.endGame('quit');
    }
  }

  openLab(): void {
    void this.router.navigate(['/chess-runner/laboratorio']);
  }

  goToHome(): void {
    void this.router.navigate(['/home']);
  }

  private clearWallHint(): void {
    if (this.recordTimeout) {
      clearTimeout(this.recordTimeout);
      this.recordTimeout = null;
    }
    this.recordBannerVisible = false;
    if (this.wallHintTimeout) {
      clearTimeout(this.wallHintTimeout);
      this.wallHintTimeout = null;
    }
    this.wallHintVisible = false;
    this.wallHintAt = null;
  }

  private clearTransition(): void {
    if (this.transitionTimeout) {
      clearTimeout(this.transitionTimeout);
      this.transitionTimeout = null;
    }
  }
}
