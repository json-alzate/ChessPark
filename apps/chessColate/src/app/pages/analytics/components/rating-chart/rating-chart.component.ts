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

import { Chart, ChartDataset, registerables } from 'chart.js';

import { ChessPlatform } from '@cpark/models';
import { RatingDataPoint } from '@chesspark/game-reporter';

import { thinSeries } from '@services/game-analytics.util';

/** Color de cada plataforma en la gráfica; el verde es el de chess.com. */
const PLATFORM_COLORS: Record<ChessPlatform, string> = {
  'chess.com': '#81b64c',
  lichess: '#f28c18',
};

/**
 * Progreso del rating del usuario a lo largo del tiempo.
 *
 * Una línea por plataforma, porque los ratings de chess.com y lichess no son
 * comparables: juntarlos en una sola línea dibujaría saltos de trescientos
 * puntos que el usuario nunca dio.
 */
@Component({
  selector: 'app-rating-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rating-chart.component.html',
  styleUrls: ['./rating-chart.component.scss'],
})
export class RatingChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('canvas', { static: false })
  canvas!: ElementRef<HTMLCanvasElement>;

  @Input() points: RatingDataPoint[] = [];

  private chart: Chart | null = null;
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

    this.chart = new Chart(element, {
      type: 'line',
      data: { datasets: this.buildDatasets() },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        // Los puntos ya vienen como {x, y}: sin esto Chart.js buscaría labels
        parsing: false,
        animation: false,
        interaction: { mode: 'nearest', intersect: false },
        plugins: {
          legend: {
            display: this.buildDatasets().length > 1,
            labels: { color: '#e5e7eb', boxWidth: 12 },
          },
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

  /** Una serie por plataforma que tenga partidas. */
  private buildDatasets(): ChartDataset<'line', { x: number; y: number }[]>[] {
    const platforms = [...new Set(this.points.map((point) => point.platform))];

    return platforms.map((platform) => {
      const series = thinSeries(
        this.points.filter((point) => point.platform === platform)
      );

      return {
        label: platform,
        data: series.map((point) => ({ x: point.date, y: point.rating })),
        borderColor: PLATFORM_COLORS[platform],
        backgroundColor: PLATFORM_COLORS[platform],
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
