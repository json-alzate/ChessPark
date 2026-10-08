import { findCheckedKings } from './find-checked-kings';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Contador para dar a cada tablero su propio id de degradado (varios tableros pueden convivir). */
let instances = 0;

/**
 * Extensión de cm-chessboard que pinta de rojo la casilla del rey en jaque, como chess.com:
 * un degradado radial, más intenso al centro, que tiñe toda la casilla.
 *
 * Se redibuja sola en cada cambio de posición y cuando el tablero se redibuja (giro,
 * cambio de tamaño), así que los componentes no tienen que hacer nada. Dibuja en su propia
 * capa, no con `Markers`: los componentes limpian los marcadores a cada rato y se llevarían
 * el rojo por delante.
 *
 * Se usa como cualquier extensión: `extensions: [{ class: CheckHighlight }]`.
 */
export class CheckHighlight {
  private readonly group: SVGGElement;
  private readonly gradientId = `cm-check-gradient-${instances++}`;

  // El tablero de cm-chessboard no tiene tipos para su estado interno
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly chessboard: any) {
    this.group = document.createElementNS(SVG_NS, 'g');
    this.group.setAttribute('class', 'check-highlight');
    this.group.appendChild(this.buildGradient());
    // Debajo de los marcadores y de las piezas, encima de las casillas
    const layer: SVGElement = chessboard.view.markersLayer;
    layer.insertBefore(this.group, layer.firstChild);

    this.register('positionChanged', () => this.draw());
    this.register('afterRedrawBoard', () => this.draw());
    this.register('destroy', () => this.group.remove());
  }

  private register(point: string, callback: () => void): void {
    const points = this.chessboard.state.extensionPoints;
    (points[point] ??= []).push(callback);
  }

  private buildGradient(): SVGDefsElement {
    const defs = document.createElementNS(SVG_NS, 'defs');
    const gradient = document.createElementNS(SVG_NS, 'radialGradient');
    gradient.setAttribute('id', this.gradientId);
    [
      ['0', '#ff0000', '0.9'],
      ['0.6', '#e70000', '0.75'],
      ['1', '#a90000', '0.5'],
    ].forEach(([offset, color, opacity]) => {
      const stop = document.createElementNS(SVG_NS, 'stop');
      stop.setAttribute('offset', offset);
      stop.setAttribute('stop-color', color);
      stop.setAttribute('stop-opacity', opacity);
      gradient.appendChild(stop);
    });
    defs.appendChild(gradient);
    return defs;
  }

  private draw(): void {
    // El primer redibujado ocurre antes de que exista la posición
    if (!this.chessboard.state.position) return;

    this.group.querySelectorAll('rect').forEach((rect) => rect.remove());
    const view = this.chessboard.view;
    for (const square of findCheckedKings(this.chessboard.getPosition())) {
      const { x, y } = view.squareToPoint(square);
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('class', 'check-square');
      rect.setAttribute('x', String(x));
      rect.setAttribute('y', String(y));
      rect.setAttribute('width', String(view.squareWidth));
      rect.setAttribute('height', String(view.squareHeight));
      rect.setAttribute('fill', `url(#${this.gradientId})`);
      this.group.appendChild(rect);
    }
  }
}
