import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  BOARD_STYLE_OPTIONS,
  FenBoardComponent,
  PIECES_STYLE_OPTIONS,
} from '@chesspark/board';
import { APP_THEMES, AppTheme, BoardStyle, PiecesStyle } from '@chesspark/models';

import { AppearanceService } from '@services/app/appearance.service';

type PickerTab = 'pieces' | 'board' | 'theme';

/** Medio juego con piezas de todos los tipos y colores, para ver bien cada estilo. */
const PREVIEW_FEN = 'r1bq1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N2NP1/PP2PPBP/R1BQ1RK1 w - - 0 9';

/**
 * Selector de estilo de piezas y color del tablero, con un tablero de muestra que
 * cambia al instante. Lo usan Ajustes y el onboarding; los cambios los guarda
 * `AppearanceService`.
 */
@Component({
  selector: 'app-appearance-picker',
  standalone: true,
  imports: [TranslocoPipe, FenBoardComponent],
  templateUrl: './appearance-picker.component.html',
  styles: [
    `
      :host {
        display: block;
      }
      :host(.fill) {
        height: 100%;
      }
      .strip {
        scrollbar-width: none;
      }
      .strip::-webkit-scrollbar {
        display: none;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.fill]': 'compact()' },
})
export class AppearancePickerComponent {
  readonly appearance = inject(AppearanceService);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Versión para el onboarding: ocupa el alto que le den (el padre debe darle uno) y reparte
   * así el espacio, para que no haga falta scroll.
   */
  readonly compact = input(false);

  readonly previewFen = PREVIEW_FEN;
  readonly piecesOptions = PIECES_STYLE_OPTIONS.map((name) => ({
    name,
    sample: `assets/images/pieces/${name}-wn.svg`,
  }));
  readonly boardOptions = BOARD_STYLE_OPTIONS;
  readonly themeOptions = APP_THEMES;

  /** Pestañas de la versión compacta; la de tema solo sale si `showTheme` está activo. */
  readonly tabs: { id: PickerTab; labelKey: string }[] = [
    { id: 'pieces', labelKey: 'APPEARANCE.pieces' },
    { id: 'board', labelKey: 'APPEARANCE.board' },
    { id: 'theme', labelKey: 'APPEARANCE.themeTab' },
  ];
  readonly tab = signal<PickerTab>('pieces');

  /** Muestra también el tema de DaisyUI de toda la app (el onboarding solo ofrece tablero y piezas). */
  readonly showTheme = input(true);

  private readonly piecesStrip = viewChild<ElementRef<HTMLElement>>('piecesStrip');
  private readonly boardStrip = viewChild<ElementRef<HTMLElement>>('boardStrip');
  private readonly themeStrip = viewChild<ElementRef<HTMLElement>>('themeStrip');

  constructor() {
    // Mantiene centrada la opción elegida cuando cambia (al elegir o desde fuera)
    effect(() => {
      this.appearance.pieces();
      this.appearance.board();
      this.appearance.theme();
      // Espera a que el DOM refleje la opción elegida
      setTimeout(() => this.centerAll('smooth'));
    });

    // Al abrirse dentro de un modal, la tira puede medir 0 mientras este se anima, y el
    // centrado inicial no sirve. Se repite cada vez que la tira cambia de tamaño.
    afterNextRender(() => {
      const observer = new ResizeObserver(() => this.centerAll('auto'));
      [this.piecesStrip(), this.boardStrip(), this.themeStrip()].forEach((strip) => {
        if (strip) observer.observe(strip.nativeElement);
      });
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  private centerAll(behavior: ScrollBehavior): void {
    [this.piecesStrip(), this.boardStrip(), this.themeStrip()].forEach((strip) => {
      if (strip) this.centerSelected(strip.nativeElement, behavior);
    });
  }

  /** Desplaza la tira, sin tocar la página, para dejar la opción elegida al centro. */
  private centerSelected(strip: HTMLElement, behavior: ScrollBehavior): void {
    const selected = strip.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!selected || strip.clientWidth === 0) return;
    strip.scrollTo({
      left: selected.offsetLeft - (strip.clientWidth - selected.offsetWidth) / 2,
      behavior,
    });
  }

  selectPieces(name: PiecesStyle): void {
    this.appearance.setPieces(name);
  }

  selectBoard(name: BoardStyle): void {
    this.appearance.setBoard(name);
  }

  selectTheme(name: AppTheme): void {
    this.appearance.setTheme(name);
  }
}
