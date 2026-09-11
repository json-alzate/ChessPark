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
  getPieceHeatmap,
  PieceHeatmap,
  TrackedPiece,
} from '@chesspark/game-reporter';
import {
  BoardGamePlayerComponent,
  BoardHeatmapComponent,
} from '@chesspark/board';

import { AnalyticsService } from '@services/analytics.service';
import { GamesService } from '@services/games.service';
import {
  PLAYBACK_SPEEDS,
  PlaybackSettings,
  boardPieceCode,
  buildPlayOrder,
  defaultHeatmapPiece,
  moveNumberOfPly,
  nextPosition,
  pieceSymbol,
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

  /** El tablero enseña por dónde se movió una pieza en vez de la partida. */
  heatmapMode = false;
  heatmap: PieceHeatmap | null = null;
  /** De qué color son las piezas que ofrece el selector. */
  heatmapColor: 'w' | 'b' = 'w';
  selectedPieceId = '';
  /** La partida es del usuario (se abrió desde Análisis). */
  isOwnGame = false;

  readonly pieceSymbol = pieceSymbol;
  readonly moveNumberOfPly = moveNumberOfPly;
  readonly boardPieceCode = boardPieceCode;

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
  get heatmapColorOptions(): Array<{ color: 'w' | 'b'; label: string }> {
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

    if (this.heatmapMode) {
      this.loadHeatmap();
    }
  }

  // — Mapa de calor ——————————————————————————————————————————

  /**
   * Cambia entre ver la partida y ver el mapa de calor. Al volver a la partida
   * el reproductor se monta de nuevo desde la posición inicial.
   */
  setHeatmapMode(on: boolean): void {
    if (on === this.heatmapMode) {
      return;
    }

    if (on) {
      if (this.isPlaying) {
        this.board?.togglePlay();
      }
      this.loadHeatmap();
      void this.analytics.logEvent('game_heatmap_opened', {
        source: this.isOwnGame ? 'analytics' : 'catalog',
      });
    } else {
      this.currentMove = 0;
    }

    this.heatmapMode = on;
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
    // Salir de la pantalla siempre suelta la pantalla encendida.
    void this.gamesService.keepScreenAwake(false);
  }
}
