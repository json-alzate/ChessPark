import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  viewChild,
} from '@angular/core';
import { encodeQr } from '@features/stream/utils/qr-code.util';
import type { CountdownDisplay } from '@features/stream/utils/panel-state.util';
import { CHESSCOLATE_URL } from '@features/stream/config/stream-links.config';

/** Módulos de margen en blanco alrededor del QR (la norma pide 4). */
const QUIET_ZONE = 4;
/** Píxeles de pantalla por módulo: entero, para que los bordes salgan nítidos. */
const PIXELS_PER_MODULE = 4;

const QR_LIGHT = '#ffffff';
const QR_DARK = '#1b1730';

/** Panel de información del directo: cuenta atrás, tema, ELO, próximo tema y QR. */
@Component({
  selector: 'ls-hud-panel',
  templateUrl: './hud-panel.component.html',
  styleUrl: './hud-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HudPanelComponent {
  /** Tema consultado, con el nombre en inglés sencillo. */
  readonly tema = input('—');
  /** ELO del puzzle en pantalla. */
  readonly elo = input<number | null>(null);
  readonly countdown = input.required<CountdownDisplay>();
  /** Tiempo hasta el próximo tema, ya en `mm:ss`. */
  readonly nextTopic = input('--:--');

  private readonly matrix = encodeQr(CHESSCOLATE_URL);
  private readonly modules = this.matrix.length + QUIET_ZONE * 2;
  /** Lado del QR en pantalla, en píxeles. */
  protected readonly qrSize = this.modules * PIXELS_PER_MODULE;
  protected readonly qrModules = this.modules;

  private readonly qr = viewChild.required<ElementRef<HTMLCanvasElement>>('qr');

  constructor() {
    afterNextRender(() => this.drawQr());
  }

  /** Dibuja el QR de la web de ChessColate: un píxel del canvas por módulo, ampliado con CSS. */
  private drawQr(): void {
    const ctx = this.qr().nativeElement.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.fillStyle = QR_LIGHT;
    ctx.fillRect(0, 0, this.modules, this.modules);
    ctx.fillStyle = QR_DARK;
    this.matrix.forEach((row, r) =>
      row.forEach((dark, c) => {
        if (dark) {
          ctx.fillRect(c + QUIET_ZONE, r + QUIET_ZONE, 1, 1);
        }
      })
    );
  }
}
