import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  playBackOutline,
  chevronBackOutline,
  chevronForwardOutline,
  playForwardOutline,
  playSkipForwardOutline,
  playSkipBackOutline,
  playOutline,
  pauseOutline,
  swapVerticalOutline,
  volumeHighOutline,
  volumeMuteOutline,
  shuffleOutline,
  repeatOutline,
  speedometerOutline,
} from 'ionicons/icons';

import { ParsedGame } from '@chesspark/games-provider';
import {
  GameReview,
  getPieceHeatmap,
  MoveReview,
  PieceHeatmap,
  PieceRating,
  reviewGame,
  TrackedPiece,
} from '@chesspark/game-reporter';
import {
  BoardGamePlayerComponent,
  BoardHeatmapComponent,
} from '@chesspark/board';

import { AnalyticsService } from '@services/analytics.service';
import { GamesService } from '@services/games.service';
import { GameReviewService } from '@services/game-review.service';
import {
  PLAYBACK_SPEEDS,
  PlaybackSettings,
  boardPieceCode,
  buildPlayOrder,
  defaultHeatmapPiece,
  moveAnnotation,
  moveNumberOfPly,
  nextPosition,
  pieceSymbol,
  rankedPieces,
  ratingTone,
} from '@services/games.util';

addIcons({
  arrowBackOutline,
  playBackOutline,
  chevronBackOutline,
  chevronForwardOutline,
  playForwardOutline,
  playSkipForwardOutline,
  playSkipBackOutline,
  playOutline,
  pauseOutline,
  swapVerticalOutline,
  volumeHighOutline,
  volumeMuteOutline,
  shuffleOutline,
  repeatOutline,
  speedometerOutline,
});

/** Pausa entre una partida y la siguiente en modo TV. */
const GAP_BETWEEN_GAMES_MS = 2500;

/** Las pestañas del reproductor. */
type ViewerMode = 'game' | 'heatmap' | 'review';

/**
 * Reproductor de una partida, y el modo TV que encadena toda la colección.
 *
 * El tablero es de solo mirar: los controles de aquí son los que mandan.
 */
@Component({
  selector: 'app-games-viewer',
  templateUrl: './viewer.page.html',
  styleUrls: ['./viewer.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    TranslocoPipe,
    IonContent,
    IonIcon,
    BoardGamePlayerComponent,
    BoardHeatmapComponent,
  ],
})
export class GamesViewerPage implements OnInit, OnDestroy {
  @ViewChild(BoardGamePlayerComponent) board?: BoardGamePlayerComponent;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private gamesService = inject(GamesService);
  private analytics = inject(AnalyticsService);
  private gameReview = inject(GameReviewService);

  game: ParsedGame | null = null;
  notFound = false;

  /** Jugada actual (0 = posición inicial). */
  currentMove = 0;
  isPlaying = false;
  orientation: 'w' | 'b' = 'w';
  /**
   * Desde qué lado se ve cada partida al cargarla. Blancas por defecto; las
   * partidas propias de Análisis piden el color con el que jugó el usuario.
   */
  private startOrientation: 'w' | 'b' = 'w';

  settings: PlaybackSettings = this.gamesService.getSettings();
  readonly speeds = PLAYBACK_SPEEDS;

  /** Modo TV: se entró para ver la colección entera. */
  isTv = false;
  /** Orden en que el TV recorre las partidas (índices dentro del paquete). */
  private playOrder: number[] = [];
  /** Dónde está el TV dentro de ese recorrido. */
  private position = 0;

  private gapTimer?: ReturnType<typeof setTimeout>;

  /** La partida que está cargada, dentro del paquete. */
  private currentIndex = 0;

  // — Mapa de calor ——————————————————————————————————————————

  /** Qué pestaña se ve: la partida, el mapa de calor o la valoración. */
  mode: ViewerMode = 'game';
  heatmap: PieceHeatmap | null = null;
  /** De qué color son las piezas que ofrece el selector. */
  heatmapColor: 'w' | 'b' = 'w';
  selectedPieceId = '';
  /** La partida es del usuario (se abrió desde Análisis). */
  isOwnGame = false;

  readonly pieceSymbol = pieceSymbol;
  readonly moveNumberOfPly = moveNumberOfPly;
  readonly boardPieceCode = boardPieceCode;

  // — Valoración de las piezas ————————————————————————————————

  review: GameReview | null = null;
  /** Stockfish está analizando la partida. */
  reviewing = false;
  /** Avance del análisis, de 0 a 100. */
  reviewProgress = 0;
  reviewFailed = false;
  /** De qué color son las piezas de la clasificación. */
  reviewColor: 'w' | 'b' = 'w';
  private reviewByPly = new Map<number, MoveReview>();

  readonly ratingTone = ratingTone;

  get heatmapMode(): boolean {
    return this.mode === 'heatmap';
  }

  get reviewMode(): boolean {
    return this.mode === 'review';
  }

  get collectionName(): string {
    return this.gamesService.currentPack?.collection.name ?? '';
  }

  get totalMoves(): number {
    return this.game ? this.game.fens.length - 1 : 0;
  }

  /** Las piezas del color elegido, para el selector. */
  get heatmapPieces(): TrackedPiece[] {
    return (
      this.heatmap?.pieces.filter((piece) => piece.color === this.heatmapColor) ??
      []
    );
  }

  get selectedPiece(): TrackedPiece | null {
    return (
      this.heatmap?.pieces.find((piece) => piece.id === this.selectedPieceId) ??
      null
    );
  }

  /**
   * Los dos colores del selector. En una partida propia se nombran como el
   * usuario la vive —sus piezas y las del rival—, y el suyo va primero.
   */
  get colorOptions(): Array<{ color: 'w' | 'b'; label: string }> {
    if (!this.isOwnGame) {
      return [
        { color: 'w', label: 'GAMES.heatmap.white' },
        { color: 'b', label: 'GAMES.heatmap.black' },
      ];
    }
    const own = this.startOrientation;
    return [
      { color: own, label: 'GAMES.heatmap.yourPieces' },
      { color: own === 'w' ? 'b' : 'w', label: 'GAMES.heatmap.opponent' },
    ];
  }

  /** Las piezas con nota del color elegido, de la mejor a la peor. */
  get rankedPieces(): PieceRating[] {
    return rankedPieces(this.review?.pieces ?? [], this.reviewColor);
  }

  /** Las piezas de ese color que no se movieron y se quedan sin nota. */
  get unratedPieces(): PieceRating[] {
    return (
      this.review?.pieces.filter(
        (piece) => piece.color === this.reviewColor && piece.rating === null
      ) ?? []
    );
  }

  get bestPiece(): PieceRating | null {
    return this.review?.best[this.reviewColor] ?? null;
  }

  get worstPiece(): PieceRating | null {
    return this.review?.worst[this.reviewColor] ?? null;
  }

  get tvPositionLabel(): { current: number; total: number } {
    return { current: this.position + 1, total: this.playOrder.length };
  }

  ngOnInit(): void {
    const pack = this.gamesService.currentPack;
    if (!pack) {
      this.router.navigate(['/games']);
      return;
    }

    const params = this.route.snapshot.queryParamMap;
    this.isTv = params.get('tv') === '1';
    this.startOrientation = params.get('color') === 'b' ? 'b' : 'w';
    this.isOwnGame = params.get('source') === 'analytics';
    const index = Number(params.get('index') ?? 0);

    if (this.isTv) {
      this.playOrder = buildPlayOrder(pack.headers, this.settings.shuffle);
      const found = this.playOrder.indexOf(index);
      this.position = found >= 0 ? found : 0;
      this.loadGame(this.playOrder[this.position]);
      // En modo TV se entra a ver, no a decidir: arranca solo.
      setTimeout(() => this.board?.play(), 400);
    } else {
      this.loadGame(index);
    }

    void this.analytics.logEvent('game_opened', {
      source: this.isTv ? 'tv' : params.get('source') ?? 'catalog',
      player: pack.collection.id || 'own_pgn',
    });
  }

  /** Carga una partida del paquete. Si no se deja leer, el TV pasa a la siguiente. */
  private loadGame(index: number): void {
    const game = this.gamesService.getGame(index);

    if (!game) {
      if (this.isTv) {
        this.goToNextGame();
        return;
      }
      this.notFound = true;
      return;
    }

    this.game = game;
    this.currentIndex = index;
    this.currentMove = 0;
    this.notFound = false;
    // Blancas abajo, salvo que quien abrió la partida pidiera otro lado
    this.orientation = this.startOrientation;

    // Partida nueva: lo calculado para la anterior ya no vale
    this.gameReview.cancel();
    this.review = null;
    this.reviewByPly = new Map();
    this.reviewing = false;
    this.reviewFailed = false;

    if (this.heatmapMode) {
      this.loadHeatmap();
    }
    if (this.reviewMode) {
      void this.loadReview();
    }
  }

  // — Mapa de calor ——————————————————————————————————————————

  /**
   * Cambia de pestaña. El mapa de calor cambia el tablero, así que al salir de
   * él el reproductor se monta de nuevo desde la posición inicial; entre la
   * partida y la valoración el tablero es el mismo y no se toca.
   */
  setMode(mode: ViewerMode): void {
    if (mode === this.mode) {
      return;
    }

    const source = this.isOwnGame ? 'analytics' : 'catalog';

    if (mode === 'heatmap') {
      if (this.isPlaying) {
        this.board?.togglePlay();
      }
      this.loadHeatmap();
      void this.analytics.logEvent('game_heatmap_opened', { source });
    } else if (this.mode === 'heatmap') {
      this.currentMove = 0;
    }

    this.mode = mode;

    if (mode === 'review') {
      void this.analytics.logEvent('game_review_opened', { source });
      if (!this.review && !this.reviewing) {
        void this.loadReview();
      }
    }
  }

  setHeatmapColor(color: 'w' | 'b'): void {
    this.heatmapColor = color;
    this.selectedPieceId =
      defaultHeatmapPiece(this.heatmap?.pieces ?? [], color)?.id ?? '';
  }

  selectPiece(piece: TrackedPiece): void {
    this.selectedPieceId = piece.id;
  }

  /** La jugada `ply` la hizo la pieza elegida: se resalta en la lista. */
  isSelectedPieceMove(ply: number): boolean {
    return (
      this.heatmapMode && (this.selectedPiece?.plies.includes(ply) ?? false)
    );
  }

  // — Valoración de las piezas ————————————————————————————————

  /**
   * Analiza la partida con Stockfish —o la saca de lo guardado— y pone nota a
   * cada pieza. Si se cambia de partida a medias, el análisis se cancela y su
   * resultado se descarta.
   */
  async loadReview(): Promise<void> {
    const game = this.game;
    const pgn = this.gamesService.getGamePgn(this.currentIndex);
    if (!game || !pgn) {
      this.reviewFailed = true;
      return;
    }

    this.reviewColor = this.startOrientation;
    this.reviewing = true;
    this.reviewFailed = false;
    this.reviewProgress = 0;

    try {
      const evals = await this.gameReview.evaluatePositions(
        game.fens,
        (done, total) => {
          this.reviewProgress = Math.round((done / total) * 100);
        }
      );

      // Cancelado: quien canceló ya dejó la pantalla como tiene que estar
      if (evals === null || game !== this.game) {
        return;
      }

      this.review = reviewGame(pgn, evals);
      this.reviewByPly = new Map(
        (this.review?.moves ?? []).map((move) => [move.ply, move])
      );
      this.reviewFailed = this.review === null;
    } catch (error) {
      console.error('Error al valorar la partida:', error);
      this.reviewFailed = true;
    } finally {
      if (game === this.game) {
        this.reviewing = false;
      }
    }
  }

  setReviewColor(color: 'w' | 'b'): void {
    this.reviewColor = color;
  }

  /** La marca de la jugada en la lista ('?!', '?', '??'), solo en la valoración. */
  annotationOf(ply: number): string {
    if (!this.reviewMode) {
      return '';
    }
    const verdict = this.reviewByPly.get(ply);
    return verdict ? moveAnnotation(verdict.classification) : '';
  }

  /** Calcula el mapa de la partida cargada y elige la pieza de partida. */
  private loadHeatmap(): void {
    const pgn = this.gamesService.getGamePgn(this.currentIndex);
    this.heatmap = pgn ? getPieceHeatmap(pgn) : null;
    this.setHeatmapColor(this.startOrientation);
  }

  // — Controles del tablero ————————————————————————————————

  togglePlay(): void {
    this.board?.togglePlay();
  }

  onPlayingChange(playing: boolean): void {
    this.isPlaying = playing;
    // La pantalla solo se mantiene encendida mientras algo se está moviendo.
    void this.gamesService.keepScreenAwake(playing);
  }

  onIndexChange(index: number): void {
    this.currentMove = index;
  }

  /** Terminó la partida: en modo TV, encadenar con la siguiente. */
  onGameFinished(): void {
    if (!this.isTv || !this.settings.autoNextGame) {
      return;
    }
    this.gapTimer = setTimeout(() => this.goToNextGame(), GAP_BETWEEN_GAMES_MS);
  }

  previousMove(): void {
    this.board?.previous();
  }

  nextMove(): void {
    this.board?.next();
  }

  toStart(): void {
    this.board?.toStart();
  }

  toEnd(): void {
    this.board?.toEnd();
  }

  goToMove(index: number): void {
    this.board?.goTo(index);
  }

  flipBoard(): void {
    this.board?.flip();
    this.orientation = this.orientation === 'w' ? 'b' : 'w';
  }

  // — Ajustes ————————————————————————————————————————————————

  setSpeed(msPerMove: number): void {
    this.settings = this.gamesService.saveSettings({ msPerMove });
    void this.analytics.logEvent('games_speed_changed', {
      ms_per_move: msPerMove,
    });
  }

  toggleSound(): void {
    this.settings = this.gamesService.saveSettings({
      soundEnabled: !this.settings.soundEnabled,
    });
  }

  toggleShuffle(): void {
    this.settings = this.gamesService.saveSettings({
      shuffle: !this.settings.shuffle,
    });
    // Rebarajar deja el recorrido nuevo pero conserva la partida en curso.
    const pack = this.gamesService.currentPack;
    if (this.isTv && pack) {
      const currentIndex = this.playOrder[this.position];
      this.playOrder = buildPlayOrder(pack.headers, this.settings.shuffle);
      this.position = Math.max(this.playOrder.indexOf(currentIndex), 0);
    }
  }

  toggleLoop(): void {
    this.settings = this.gamesService.saveSettings({
      loopCollection: !this.settings.loopCollection,
    });
  }

  toggleAutoNext(): void {
    this.settings = this.gamesService.saveSettings({
      autoNextGame: !this.settings.autoNextGame,
    });
  }

  // — Navegación entre partidas (modo TV) ——————————————————

  goToNextGame(): void {
    const next = nextPosition(
      this.position,
      this.playOrder.length,
      this.settings.loopCollection
    );

    if (next === null) {
      // Se acabó la colección y la repetición está apagada.
      void this.gamesService.keepScreenAwake(false);
      return;
    }

    this.position = next;
    this.loadGame(this.playOrder[this.position]);
    void this.analytics.logEvent('games_tv_next', { index: this.position });
    setTimeout(() => this.board?.play(), 400);
  }

  goToPreviousGame(): void {
    if (this.playOrder.length === 0) {
      return;
    }
    this.position =
      this.position > 0 ? this.position - 1 : this.playOrder.length - 1;
    this.loadGame(this.playOrder[this.position]);
    setTimeout(() => this.board?.play(), 400);
  }

  goBack(): void {
    history.back();
  }

  ngOnDestroy(): void {
    clearTimeout(this.gapTimer);
    // Un análisis a medias no debe seguir ocupando Stockfish fuera de aquí
    this.gameReview.cancel();
    // Salir de la pantalla siempre suelta la pantalla encendida.
    void this.gamesService.keepScreenAwake(false);
  }
}
