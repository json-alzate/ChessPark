import { Component, Input, ElementRef, ViewChild, AfterViewInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-line-chart',
  standalone: true,
  imports: [CommonModule],
  template: `<canvas #chartCanvas width="350" height="180" style="display: block; max-width: 100%;"></canvas>`
})
export class LineChartComponent implements AfterViewInit {
  @ViewChild('chartCanvas', { static: true }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  @Input() labels: string[] = [];
  @Input() data: number[] = [];
  @Input() label = 'Ingresos';
  @Input() lineColor = '';
  @Input() bgColor = '';

  chart: Chart | undefined;

  private defaultLabels = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio'];
  private defaultData = [3200, 3500, 4000, 4200, 4100, 4300];

  constructor(private ngZone: NgZone) {}

  ngAfterViewInit() {
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        this.renderChart();
      }, 0);
    });
  }

  renderChart() {
    const labels = this.labels && this.labels.length ? this.labels : this.defaultLabels;
    const data = this.data && this.data.length ? this.data : this.defaultData;
    // Obtener color de CSS variable si se pasa lineColor, si no usar por defecto
    let borderColor = this.lineColor || getComputedStyle(document.documentElement).getPropertyValue('--p') || 'rgba(34,197,94,1)';
    let backgroundColor = this.bgColor || getComputedStyle(document.documentElement).getPropertyValue('--pf') || 'rgba(34,197,94,0.2)';
    borderColor = borderColor.trim() || 'rgba(34,197,94,1)';
    backgroundColor = backgroundColor.trim() || 'rgba(34,197,94,0.2)';
    console.log('Renderizando gráfico', labels, data, this.label, borderColor, backgroundColor);
    if (this.chart) {
      this.chart.destroy();
    }
    this.chart = new Chart(this.chartCanvas.nativeElement, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: this.label,
            data: data,
            borderColor: borderColor,
            backgroundColor: backgroundColor,
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: borderColor,
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: { display: true },
          y: { display: true, beginAtZero: true }
        }
      }
    });
  }
} 