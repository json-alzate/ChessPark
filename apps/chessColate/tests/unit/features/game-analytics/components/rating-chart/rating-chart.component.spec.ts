// Chart.js necesita un canvas real; jsdom no lo tiene. Se sustituye por un doble que
// guarda la configuración con la que se creó cada gráfica.
jest.mock('chart.js', () => {
  class Chart {
    static register = jest.fn();
    static instances: Chart[] = [];
    destroy = jest.fn();
    update = jest.fn();
    constructor(public element: unknown, public config: any) {
      Chart.instances.push(this);
    }
  }
  return { Chart, registerables: [] };
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Chart } from 'chart.js';

import { RatingDataPoint } from '@chesspark/game-reporter';
import { RatingChartComponent } from '@features/game-analytics/components/rating-chart/rating-chart.component';

import { textoDe, translocoTesting } from '@tests/support/analisis-juegos';

type Doble = {
  element: unknown;
  config: any;
  destroy: jest.Mock;
};
const creadas = (): Doble[] => (Chart as unknown as { instances: Doble[] }).instances;

function punto(
  date: number,
  rating: number,
  platform: RatingDataPoint['platform'] = 'chess.com',
  timeClass: RatingDataPoint['timeClass'] = 'blitz'
): RatingDataPoint {
  return { date, rating, platform, timeClass };
}

describe('RatingChartComponent', () => {
  let fixture: ComponentFixture<RatingChartComponent>;
  let component: RatingChartComponent;

  beforeEach(async () => {
    creadas().length = 0;
    await TestBed.configureTestingModule({
      imports: [RatingChartComponent, translocoTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(RatingChartComponent);
    component = fixture.componentInstance;
  });

  function conPuntos(points: RatingDataPoint[]) {
    fixture.componentRef.setInput('points', points);
    fixture.detectChanges();
  }

  it('sin puntos no crea ninguna gráfica', () => {
    conPuntos([]);
    expect(creadas()).toHaveLength(0);
  });

  it('dibuja sobre el canvas de la plantilla', () => {
    conPuntos([punto(1, 1500)]);
    expect(creadas()).toHaveLength(1);
    expect(creadas()[0].element).toBe(fixture.nativeElement.querySelector('canvas'));
    expect(creadas()[0].config.type).toBe('line');
  });

  it('crea una serie por cada combinación de plataforma y ritmo', () => {
    conPuntos([
      punto(1, 1500, 'chess.com', 'blitz'),
      punto(2, 1510, 'chess.com', 'blitz'),
      punto(3, 1200, 'chess.com', 'bullet'),
      punto(4, 1550, 'lichess', 'blitz'),
    ]);
    const series = creadas()[0].config.data.datasets;
    expect(series.map((s: any) => s.label)).toEqual([
      'Blitz · chess.com',
      'Bullet · chess.com',
      'Blitz · lichess',
    ]);
    expect(series[0].data).toEqual([
      { x: 1, y: 1500 },
      { x: 2, y: 1510 },
    ]);
  });

  it('el color lo marca el ritmo y el trazo punteado la plataforma lichess', () => {
    conPuntos([
      punto(1, 1500, 'chess.com', 'blitz'),
      punto(2, 1500, 'lichess', 'blitz'),
      punto(3, 1500, 'chess.com', 'rapid'),
    ]);
    const [chesscomBlitz, lichessBlitz, chesscomRapid] = creadas()[0].config.data.datasets;
    expect(chesscomBlitz.borderColor).toBe(lichessBlitz.borderColor);
    expect(chesscomBlitz.borderColor).not.toBe(chesscomRapid.borderColor);
    expect(chesscomBlitz.borderDash).toEqual([]);
    expect(lichessBlitz.borderDash.length).toBeGreaterThan(0);
  });

  it('adelgaza las series muy largas conservando el último punto', () => {
    const muchos = Array.from({ length: 1000 }, (_, i) => punto(i, 1000 + i));
    conPuntos(muchos);
    const datos = creadas()[0].config.data.datasets[0].data;
    expect(datos.length).toBeLessThanOrEqual(401);
    expect(datos.length).toBeLessThan(1000);
    expect(datos[0]).toEqual({ x: 0, y: 1000 });
    expect(datos[datos.length - 1]).toEqual({ x: 999, y: 1999 });
  });

  it('al cambiar los puntos destruye la gráfica anterior y crea otra', () => {
    conPuntos([punto(1, 1500)]);
    const primera = creadas()[0];
    conPuntos([punto(1, 1500), punto(2, 1600)]);
    expect(primera.destroy).toHaveBeenCalled();
    expect(creadas()).toHaveLength(2);
    expect(creadas()[1].config.data.datasets[0].data).toHaveLength(2);
  });

  it('si los puntos pasan a estar vacíos, destruye la gráfica y no crea otra', () => {
    conPuntos([punto(1, 1500)]);
    conPuntos([]);
    expect(creadas()[0].destroy).toHaveBeenCalled();
    expect(creadas()).toHaveLength(1);
  });

  it('al destruir el componente destruye la gráfica', () => {
    conPuntos([punto(1, 1500)]);
    fixture.destroy();
    expect(creadas()[0].destroy).toHaveBeenCalled();
  });

  describe('leyenda', () => {
    it('lista solo los ritmos que tienen partidas, en orden de reloj', () => {
      conPuntos([punto(1, 1, 'chess.com', 'rapid'), punto(2, 1, 'chess.com', 'bullet')]);
      expect(component.legendTimeClasses.map((l) => l.label)).toEqual(['Bullet', 'Rapid']);
      const texto = textoDe(fixture.nativeElement);
      expect(texto).toContain('Bullet');
      expect(texto).toContain('Rapid');
      expect(texto).not.toContain('Blitz');
    });

    it('lista las plataformas con partidas y marca la punteada', () => {
      conPuntos([punto(1, 1, 'chess.com'), punto(2, 1, 'lichess')]);
      expect(component.legendPlatforms).toEqual([
        { name: 'chess.com', dashed: false },
        { name: 'lichess', dashed: true },
      ]);
      expect(fixture.nativeElement.querySelectorAll('.border-dashed')).toHaveLength(1);
    });
  });
});
