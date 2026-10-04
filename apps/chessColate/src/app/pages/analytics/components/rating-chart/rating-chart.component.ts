import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';

import { Chart, ChartDataset, registerables } from 'chart.js';

import { ChessPlatform, TimeClass } from '@cpark/models';
import { RatingDataPoint } from '@chesspark/game-reporter';

import { thinSeries } from '@services/game-analytics.util';

/** Color de cada ritmo, igual para las dos plataformas: así se compara a simple vista. */
const TIME_CLASS_COLORS: Record<TimeClass, string> = {
  bullet: '#ef4444',
  blitz: '#f59e0b',
  rapid: '#22c55e',
  classical: '#3b82f6',
  daily: '#a855f7',
};

const TIME_CLASS_LABELS: Record<TimeClass, string> = {
  bullet: 'Bullet',
  blitz: 'Blitz',
  rapid: 'Rapid',
  classical: 'Classical',
  daily: 'Daily',
};

/** Lichess se dibuja punteada; así, si coincide el ritmo con chess.com, se distinguen sin otro color. */
const PLATFORM_DASH: Record<ChessPlatform, number[]> = {
  'chess.com': [],
  lichess: [6, 3],
};

/**
 * Progreso del rating del usuario a lo largo del tiempo.
 *
 * Una línea por ritmo y plataforma —bullet, blitz, rápidas…—, como lo enseña
 * lichess: los ratings de bullet y clásicas no son comparables entre sí, así
 * que juntarlos en una sola línea por plataforma dibujaría saltos que el
 * usuario nunca dio. El color marca el ritmo; el trazo continuo o punteado, la
 * plataforma. La leyenda va aparte, una sola vez, en vez de repetir la
 * plataforma en cada serie.
 */
@Component({
  selector: 'app-rating-chart',
  standalone: true,
  imports: [CommonModule, TranslocoPipe],
  templateUrl: './rating-chart.component.html',
  styleUrls: ['./rating-chart.component.scss'],
})
export class RatingChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('canvas', { static: false })
  canvas!: ElementRef<HTMLCanvasElement>;

  @Input() points: RatingDataPoint[] = [];

  private chart: Chart | null = null;

  /** Un ritmo por color, solo los que tienen partidas. */
  get legendTimeClasses(): { label: string; color: string }[] {
    const present = new Set(this.points.map((point) => point.timeClass));
    return (Object.keys(TIME_CLASS_LABELS) as TimeClass[])
      .filter((timeClass) => present.has(timeClass))
      .map((timeClass) => ({
        label: TIME_CLASS_LABELS[timeClass],
        color: TIME_CLASS_COLORS[timeClass],
      }));
  }

  /** Las plataformas con partidas, cada una con su trazo. */
  get legendPlatforms(): { name: ChessPlatform; dashed: boolean }[] {
    const present = new Set(this.points.map((point) => point.platform));
    return [...present].map((platform) => ({
      name: platform,
      dashed: PLATFORM_DASH[platform].length > 0,
    }));
  }
  private viewReady = false;

  constructor() {
    Chart.register(...registerables);
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.render();
  }

  ngOnChanges(): void {
    if (this.viewReady) {
      this.render();
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
    this.chart = null;
  }

  private render(): void {
    this.chart?.destroy();
    this.chart = null;

    const element = this.canvas?.nativeElement;
    if (!element || this.points.length === 0) {
      return;
    }

    const datasets = this.buildDatasets();

    this.chart = new Chart(element, {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        // Los puntos ya vienen como {x, y}: sin esto Chart.js buscaría labels
        parsing: false,
        animation: false,
        interaction: { mode: 'nearest', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => this.formatDate(Number(items[0].parsed.x)),
            },
          },
        },
        scales: {
          x: {
            type: 'linear',
            ticks: {
              color: '#9ca3af',
              maxTicksLimit: 5,
              callback: (value) => this.formatDate(Number(value)),
            },
            grid: { display: false },
          },
          y: {
            ticks: { color: '#9ca3af', maxTicksLimit: 6 },
            grid: { color: 'rgba(255, 255, 255, 0.06)' },
          },
        },
      },
    });
  }

  /** Una serie por cada combinación de plataforma y ritmo que tenga partidas. */
  private buildDatasets(): ChartDataset<'line', { x: number; y: number }[]>[] {
    const groups = new Map<string, RatingDataPoint[]>();
    for (const point of this.points) {
      const key = `${point.platform}:${point.timeClass}`;
      const group = groups.get(key);
      if (group) {
        group.push(point);
      } else {
        groups.set(key, [point]);
      }
    }

    return [...groups.values()].map((groupPoints) => {
      const { platform, timeClass } = groupPoints[0];
      const series = thinSeries(groupPoints);
      const color = TIME_CLASS_COLORS[timeClass];

      return {
        label: `${TIME_CLASS_LABELS[timeClass]} · ${platform}`,
        data: series.map((point) => ({ x: point.date, y: point.rating })),
        borderColor: color,
        backgroundColor: color,
        borderDash: PLATFORM_DASH[platform],
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.25,
      };
    });
  }

  private formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
    });
  }
}
