import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { Chart, LinearScale, TimeScale, Tooltip } from 'chart.js';
import {
  MatrixController,
  MatrixDataPoint,
  MatrixElement,
} from 'chartjs-chart-matrix';
import 'chartjs-adapter-date-fns';
import {
  addDays,
  endOfToday,
  format,
  getISODay,
  parseISO,
  startOfDay,
  subDays,
} from 'date-fns';
import { enUS, es } from 'date-fns/locale';

import { ActivityDay } from '@chesspark/game-reporter';

/** Días que cubre el mapa, contados hacia atrás desde hoy. */
const DAYS_SHOWN = 365;

/** Columnas del mapa: un año son 53 semanas empezadas. */
const WEEKS_SHOWN = 53;

/**
 * Calendario de actividad del último año: una columna por semana y un cuadro
 * por día, más intenso cuantas más partidas se jugaron.
 *
 * Es el mismo gráfico que tenía la app anterior (Chesscolate-old): matriz de
 * Chart.js con escalas de fecha, la semana empezando en lunes y las 53
 * columnas repartidas en todo el ancho, sin desplazamiento horizontal. A
 * diferencia de aquella, al pasar por encima de un día se ve cuántas partidas
 * hubo.
 */
@Component({
  selector: 'app-activity-heatmap',
  standalone: true,
  imports: [CommonModule, TranslocoPipe],
  templateUrl: './activity-heatmap.component.html',
  styleUrls: ['./activity-heatmap.component.scss'],
})
export class ActivityHeatmapComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  @ViewChild('matrixChart', { static: false })
  matrixChart!: ElementRef<HTMLCanvasElement>;

  @Input() days: ActivityDay[] = [];

  /** Partidas jugadas dentro del año que dibuja el mapa. */
  gamesLastYear = 0;

  private transloco = inject(TranslocoService);
  private chart: Chart<'matrix'> | null = null;

  constructor() {
    // El tooltip se registra aquí y no se da por hecho: la gráfica de rating
    // también lo registra, pero no se pinta si hay menos de dos partidas
    Chart.register(
      MatrixController,
      MatrixElement,
      LinearScale,
      TimeScale,
      Tooltip
    );
  }

  ngAfterViewInit(): void {
    this.createChart();
  }

  ngOnChanges(): void {
    const data = this.buildData();
    if (this.chart) {
      this.chart.data.datasets[0].data = data;
      this.chart.update();
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
    this.chart = null;
  }

  /**
   * Un punto por cada día del último año, tenga partidas o no: el mapa
   * necesita también los días en blanco para dibujar la cuadrícula completa.
   */
  private buildData(): MatrixDataPoint[] {
    const counts = new Map(this.days.map((day) => [day.date, day.games]));
    const end = endOfToday();
    const data: MatrixDataPoint[] = [];

    for (
      let day = startOfDay(subDays(end, DAYS_SHOWN));
      day <= end;
      day = addDays(day, 1)
    ) {
      const iso = format(day, 'yyyy-MM-dd');
      data.push({
        x: iso,
        // Día ISO de 1 (lunes) a 7 (domingo), en texto para que lo lea el
        // parser 'i' de la escala
        y: String(getISODay(day)),
        v: counts.get(iso) ?? 0,
      });
    }

    this.gamesLastYear = data.reduce((total, point) => total + (point.v ?? 0), 0);
    return data;
  }

  private createChart(): void {
    const element = this.matrixChart?.nativeElement;
    if (!element) {
      return;
    }

    const locale = this.transloco.getActiveLang() === 'es' ? es : enUS;

    this.chart = new Chart(element, {
      type: 'matrix',
      data: {
        datasets: [
          {
            label: '',
            data: this.buildData(),
            backgroundColor(context) {
              const point = context.dataset.data[
                context.dataIndex
              ] as MatrixDataPoint;
              const value = point?.v ?? 0;
              // Los días sin partidas se quedan en un verde muy tenue para que
              // la cuadrícula se vea; a partir de ahí, cada partida suma tono
              const divisor = value > 0 ? 30 : 60;
              return `rgba(78, 115, 38, ${(10 + value) / divisor})`;
            },
            borderColor: 'rgba(0, 0, 0, 0.5)',
            borderWidth: 1,
            width: ({ chart }) => {
              const area = chart.chartArea;
              return area ? (area.right - area.left) / WEEKS_SHOWN - 1 : 0;
            },
            height: ({ chart }) => {
              const area = chart.chartArea;
              return area ? (area.bottom - area.top) / 7 - 1 : 0;
            },
          },
        ],
      },
      options: {
        aspectRatio: 5,
        plugins: {
          // Al pasar por encima de un día: la fecha y cuántas partidas
          tooltip: {
            displayColors: false,
            callbacks: {
              title: (items) => {
                const point = items[0]?.raw as MatrixDataPoint | undefined;
                return point
                  ? format(parseISO(String(point.x)), 'd MMM yyyy', { locale })
                  : '';
              },
              label: (item) => {
                const games = (item.raw as MatrixDataPoint).v ?? 0;
                return games === 1
                  ? this.transloco.translate('ANALYTICS.activity.oneGame')
                  : this.transloco.translate('ANALYTICS.activity.gamesCount', {
                      count: games,
                    });
              },
            },
          },
          legend: { display: false },
        },
        scales: {
          y: {
            type: 'time',
            offset: true,
            adapters: { date: { locale } },
            time: {
              unit: 'day',
              round: 'day',
              isoWeekday: 1,
              parser: 'i',
              displayFormats: { day: 'iiiiii' },
            },
            reverse: true,
            position: 'right',
            ticks: {
              maxRotation: 0,
              autoSkip: true,
              padding: 1,
              color: '#9ca3af',
              font: { size: 9 },
            },
            grid: { display: false, tickLength: 0 },
          },
          x: {
            type: 'time',
            position: 'bottom',
            offset: true,
            adapters: { date: { locale } },
            time: {
              unit: 'week',
              round: 'week',
              isoWeekday: 1,
              displayFormats: { week: 'MMM dd' },
            },
            ticks: {
              maxRotation: 0,
              autoSkip: true,
              color: '#9ca3af',
              font: { size: 9 },
            },
            grid: { display: false, tickLength: 0 },
          },
        },
        layout: { padding: { top: 10 } },
      },
    });
  }
}
