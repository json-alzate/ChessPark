// Chart.js necesita un canvas real; jsdom no lo tiene. Se sustituyen la librería, el
// plugin de matriz y el adaptador de fechas por dobles que guardan la configuración.
jest.mock('chart.js', () => {
  class Chart {
    static register = jest.fn();
    static instances: Chart[] = [];
    destroy = jest.fn();
    update = jest.fn();
    constructor(public element: unknown, public config: any) {
      this.data = config.data;
      Chart.instances.push(this);
    }
    data: any;
  }
  return { Chart, LinearScale: {}, TimeScale: {}, Tooltip: {} };
});
jest.mock('chartjs-chart-matrix', () => ({ MatrixController: {}, MatrixElement: {} }));
jest.mock('chartjs-adapter-date-fns', () => ({}));

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { Chart } from 'chart.js';

import { ActivityDay } from '@chesspark/game-reporter';
import { ActivityHeatmapComponent } from '@app/pages/analytics/components/activity-heatmap/activity-heatmap.component';

import { textoDe, translocoTesting } from '@tests/support/analisis-juegos';

type Doble = { element: unknown; config: any; data: any; destroy: jest.Mock; update: jest.Mock };
const creadas = (): Doble[] => (Chart as unknown as { instances: Doble[] }).instances;

describe('ActivityHeatmapComponent', () => {
  let fixture: ComponentFixture<ActivityHeatmapComponent>;
  let component: ActivityHeatmapComponent;

  beforeEach(async () => {
    // Hoy: 15 de junio de 2026 (una fecha fija para que el año que dibuja el mapa sea estable)
    jest.useFakeTimers({ now: new Date(2026, 5, 15, 12, 0, 0), doNotFake: ['nextTick', 'setImmediate'] });
    creadas().length = 0;
    await TestBed.configureTestingModule({
      imports: [ActivityHeatmapComponent, translocoTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(ActivityHeatmapComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => jest.useRealTimers());

  function conDias(days: ActivityDay[]) {
    fixture.componentRef.setInput('days', days);
    fixture.detectChanges();
  }

  const puntos = () => creadas()[0].config.data.datasets[0].data as { x: string; y: string; v: number }[];

  it('crea una gráfica de matriz sobre el canvas de la plantilla', () => {
    conDias([]);
    expect(creadas()).toHaveLength(1);
    expect(creadas()[0].config.type).toBe('matrix');
    expect(creadas()[0].element).toBe(fixture.nativeElement.querySelector('canvas'));
  });

  it('dibuja un cuadro por cada día del último año, hasta hoy, también los vacíos', () => {
    conDias([]);
    const datos = puntos();
    expect(datos).toHaveLength(366);
    expect(datos[datos.length - 1].x).toBe('2026-06-15');
    expect(datos[0].x).toBe('2025-06-15');
    expect(datos.every((p) => p.v === 0)).toBe(true);
  });

  it('el día ISO va de 1 (lunes) a 7 (domingo)', () => {
    conDias([]);
    const porFecha = Object.fromEntries(puntos().map((p) => [p.x, p.y]));
    expect(porFecha['2026-06-15']).toBe('1'); // lunes
    expect(porFecha['2026-06-14']).toBe('7'); // domingo
  });

  it('cada día lleva las partidas que se jugaron en él', () => {
    conDias([
      { date: '2026-06-15', games: 4 },
      { date: '2026-01-02', games: 2 },
    ]);
    const porFecha = Object.fromEntries(puntos().map((p) => [p.x, p.v]));
    expect(porFecha['2026-06-15']).toBe(4);
    expect(porFecha['2026-01-02']).toBe(2);
    expect(porFecha['2026-06-14']).toBe(0);
  });

  it('cuenta solo las partidas del último año', () => {
    conDias([
      { date: '2026-06-15', games: 4 },
      { date: '2026-01-02', games: 2 },
      { date: '2024-01-01', games: 50 },
    ]);
    expect(component.gamesLastYear).toBe(6);
  });

  it('muestra en el encabezado cuántas partidas hubo', () => {
    conDias([{ date: '2026-06-15', games: 4 }]);
    // sin traducciones, Transloco devuelve la clave
    expect(textoDe(fixture.nativeElement)).toContain('ANALYTICS.activity.gamesLastYear');
  });

  it('al cambiar los días actualiza la gráfica existente sin crear otra', () => {
    conDias([{ date: '2026-06-15', games: 1 }]);
    conDias([{ date: '2026-06-15', games: 9 }]);
    expect(creadas()).toHaveLength(1);
    expect(creadas()[0].update).toHaveBeenCalled();
    const ultimo = creadas()[0].data.datasets[0].data.at(-1);
    expect(ultimo.v).toBe(9);
    expect(component.gamesLastYear).toBe(9);
  });

  it('al destruir el componente destruye la gráfica', () => {
    conDias([]);
    fixture.destroy();
    expect(creadas()[0].destroy).toHaveBeenCalled();
  });

  describe('tooltip', () => {
    const callbacks = () => creadas()[0].config.options.plugins.tooltip.callbacks;
    const trad = () => TestBed.inject(TranslocoService);

    it('el título es la fecha del día', () => {
      conDias([]);
      const titulo = callbacks().title([{ raw: { x: '2026-06-15', y: '1', v: 0 } }]);
      expect(titulo).toContain('2026');
      expect(titulo).toContain('15');
    });

    it('sin elemento no hay título', () => {
      conDias([]);
      expect(callbacks().title([])).toBe('');
    });

    it('con una partida usa el texto en singular', () => {
      conDias([]);
      const spy = jest.spyOn(trad(), 'translate');
      callbacks().label({ raw: { v: 1 } });
      expect(spy).toHaveBeenCalledWith('ANALYTICS.activity.oneGame');
    });

    it('con varias partidas pide el texto plural con la cantidad', () => {
      conDias([]);
      const spy = jest.spyOn(trad(), 'translate');
      callbacks().label({ raw: { v: 5 } });
      expect(spy).toHaveBeenCalledWith('ANALYTICS.activity.gamesCount', { count: 5 });
    });

    it('con cero partidas también usa el plural', () => {
      conDias([]);
      const spy = jest.spyOn(trad(), 'translate');
      callbacks().label({ raw: { v: 0 } });
      expect(spy).toHaveBeenCalledWith('ANALYTICS.activity.gamesCount', { count: 0 });
    });
  });

  describe('color de los cuadros', () => {
    const color = (v: number) => {
      const dataset = creadas()[0].config.data.datasets[0];
      return dataset.backgroundColor({ dataset: { data: [{ v }] }, dataIndex: 0 }) as string;
    };
    const alfa = (rgba: string) => Number(rgba.match(/,\s*([\d.]+)\)$/)?.[1]);

    it('un día con partidas es más intenso que uno vacío', () => {
      conDias([]);
      expect(alfa(color(5))).toBeGreaterThan(alfa(color(0)));
    });

    it('cuantas más partidas, más intenso', () => {
      conDias([]);
      expect(alfa(color(10))).toBeGreaterThan(alfa(color(2)));
    });
  });
});
