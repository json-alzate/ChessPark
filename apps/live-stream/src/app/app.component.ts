import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  HostListener,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { BoardGamePlayerComponent, isBoardStyle, isPiecesStyle, setChessboardAppearance } from '@chesspark/board/stream';
import { HudPanelComponent } from '@features/stream/components/hud-panel/hud-panel.component';
import { parseRendererKind } from '@features/scene/services/scene-renderer';
import { SceneHostComponent } from '@features/scene/components/scene-host/scene-host.component';
import { fitScale, STAGE_HEIGHT, STAGE_WIDTH } from '@core/stage/stage-scale.util';
import { appearanceAt } from '@features/stream/utils/appearance-schedule.util';
import { countdownDisplay, formatClock } from '@features/stream/utils/panel-state.util';
import { StreamDirectorService } from '@features/stream/services/stream-director.service';
import { STREAM_TIMINGS } from '@features/stream/config/stream-timings.config';

/** Posición inicial mientras llega el primer puzzle. */
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Cada cuánto rota el tablero y las piezas dentro de una misma fase del día. */
const DEFAULT_APPEARANCE_ROTATION_MS = 10 * 60_000;

/** Ciclo día/noche por defecto: 75 min (el doc propone 60–90). `?day=<ms>` lo acorta para probar. */
const DEFAULT_DAY_MS = 75 * 60_000;

@Component({
  imports: [BoardGamePlayerComponent, SceneHostComponent, HudPanelComponent],
  selector: 'ls-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  protected readonly stageWidth = STAGE_WIDTH;
  protected readonly stageHeight = STAGE_HEIGHT;
  protected readonly scale = signal(fitScale(window.innerWidth, window.innerHeight));

  private readonly query = new URLSearchParams(window.location.search);
  /** `?renderer=css|none`: `none` deja solo el tablero y el panel (sirve para medir). */
  protected readonly renderer = parseRendererKind(this.query.get('renderer'));
  protected readonly dayMs = Number(this.query.get('day')) || DEFAULT_DAY_MS;

  /** `?rotate=<ms>` acorta la rotación de apariencia para probar. */
  private readonly rotationMs = Number(this.query.get('rotate')) || DEFAULT_APPEARANCE_ROTATION_MS;

  private readonly director = inject(StreamDirectorService);
  protected readonly msPerMove = inject(STREAM_TIMINGS).moveMs;

  protected readonly fens = computed(() => this.director.onAir()?.frames.fens ?? [START_FEN]);
  protected readonly moveSquares = computed(() => this.director.onAir()?.frames.moveSquares ?? []);
  /** El tablero se ve desde el lado de quien resuelve. */
  protected readonly orientation = computed(() => this.director.onAir()?.frames.solver ?? 'w');

  protected readonly tema = computed(() => this.director.onAir()?.block.label ?? '—');
  protected readonly elo = computed(() => this.director.onAir()?.puzzle.rating ?? null);
  protected readonly countdown = computed(() =>
    countdownDisplay(this.director.phase(), this.director.countdownS(), this.director.countdownTotalS)
  );
  protected readonly nextTopic = computed(() => formatClock(this.director.nextTopicS()));

  private readonly player = viewChild(BoardGamePlayerComponent);

  constructor() {
    afterNextRender(() => this.director.start());
    inject(DestroyRef).onDestroy(() => this.director.stop());

    // Tablero y piezas cambian entre puzzles, nunca a mitad de uno. Con `?pieces=` y `?board=` se
    // fija una combinación concreta (sirve para revisar cada set) y la rotación se apaga.
    const pinnedPieces = this.query.get('pieces');
    const pinnedBoard = this.query.get('board');
    if (isPiecesStyle(pinnedPieces) || isBoardStyle(pinnedBoard)) {
      setChessboardAppearance({
        ...(isPiecesStyle(pinnedPieces) ? { pieces: pinnedPieces } : {}),
        ...(isBoardStyle(pinnedBoard) ? { board: pinnedBoard } : {}),
      });
    } else {
      effect(() => {
        if (this.director.onAir()) {
          setChessboardAppearance(appearanceAt(Date.now(), this.dayMs, this.rotationMs));
        }
      });
    }

    // El director dice en qué posición va; el tablero se mueve a ella. La posición 0 no hace
    // falta pedirla: el tablero vuelve solo al inicio cuando llega un puzzle nuevo.
    effect(() => {
      const index = this.director.frameIndex();
      if (index > 0) {
        untracked(() => this.player()?.goTo(index));
      }
    });
  }

  @HostListener('window:resize')
  protected onResize(): void {
    this.scale.set(fitScale(window.innerWidth, window.innerHeight));
  }
}
