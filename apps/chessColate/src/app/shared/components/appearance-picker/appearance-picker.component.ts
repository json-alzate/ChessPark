import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { checkmarkCircle } from 'ionicons/icons';
import { IonIcon } from '@ionic/angular/standalone';
import {
  BOARD_STYLE_OPTIONS,
  FenBoardComponent,
  PIECES_STYLE_OPTIONS,
} from '@chesspark/board';
import { BoardStyle, PiecesStyle } from '@chesspark/models';

import { AppearanceService } from '@services/app/appearance.service';

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
  imports: [TranslocoPipe, IonIcon, FenBoardComponent],
  templateUrl: './appearance-picker.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppearancePickerComponent {
  readonly appearance = inject(AppearanceService);

  /** Versión reducida para el onboarding: tablero de muestra más chico. */
  readonly compact = input(false);

  readonly previewFen = PREVIEW_FEN;
  readonly piecesOptions = PIECES_STYLE_OPTIONS.map((name) => ({
    name,
    sample: `assets/images/pieces/${name}-wn.svg`,
  }));
  readonly boardOptions = BOARD_STYLE_OPTIONS;

  constructor() {
    addIcons({ checkmarkCircle });
  }

  selectPieces(name: PiecesStyle): void {
    this.appearance.setPieces(name);
  }

  selectBoard(name: BoardStyle): void {
    this.appearance.setBoard(name);
  }
}
