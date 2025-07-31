//core and third party libraries
import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import { State, select } from '@ngrx/store';

// rxjs

// states
import { CoordinatesPuzzlesState } from '@redux/states/coordinates-puzzles.state';

// actions

// selectors
import { getLastCoordinatesPuzzles } from '@redux/selectors/coordinates-puzzles.selectors';

// models
import { CoordinatesPuzzle } from '@models/coordinates-puzzles.model';

// services

// components

@Component({
  selector: 'app-statics',
  templateUrl: './statics.component.html',
  styleUrls: ['./statics.component.scss'],
})
export class StaticsComponent implements OnInit, AfterViewInit {

  @ViewChild('lineCanvasWhite') lineCanvasWhite;
  @ViewChild('lineCanvasBlack') lineCanvasBlack;
  lineChartWhite: Chart;
  lineChartBlack: Chart;

  showCharts = false;


  constructor(
    private store: State<CoordinatesPuzzlesState>
  ) {

    Chart.register(...registerables);
  }

  ngOnInit() { }

  ngAfterViewInit() {
    this.lineChartMethod();
  }


  lineChartMethod() {

    const options = {
      responsive: true,
      plugins: {
        legend: {
          display: false,
        },
      }
    };

    this.lineChartWhite = new Chart(this.lineCanvasWhite.nativeElement, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          {
            label: '',
            data: [],
            backgroundColor: 'rgba(250, 250, 250, 0.6)',
            borderColor: 'rgba(250, 250, 250, 1)',
            borderWidth: 1
          }
        ]
      },
      options
    });

    this.lineChartBlack = new Chart(this.lineCanvasBlack.nativeElement, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          {
            label: '',
            data: [],
            backgroundColor: 'rgba(139, 140, 147, 0.5)',
            borderColor: 'rgba(82, 82, 82, 1)',
            borderWidth: 1,
            // fill: true
          }
        ]
      },
      options
    });

    this.store.pipe(
      select(getLastCoordinatesPuzzles(20)) // obtiene los últimos 20
    ).subscribe(coordinatesPuzzles => this.updateLineChart(coordinatesPuzzles));

  }


  // llega un máximo de 20 elementos (parámetro enviado en el selector)
  updateLineChart(coordinatesPuzzles: CoordinatesPuzzle[]) {

    if (coordinatesPuzzles.length > 0) {
      this.showCharts = true;
    }

    const dataForW: number[] = [];
    const dataForB: number[] = [];
    const labels: string[] = [];

    for (const coordinatesPuzzle of coordinatesPuzzles) {
      if (coordinatesPuzzle.color === 'w') {
        dataForW.push(coordinatesPuzzle.score);
      } else {
        dataForB.push(coordinatesPuzzle.score);
      }
      labels.push('');
    }

    this.lineChartWhite.data.labels = labels;
    this.lineChartBlack.data.labels = labels;

    this.lineChartWhite.data.datasets[0].data = dataForW;
    this.lineChartBlack.data.datasets[0].data = dataForB;

    console.log(labels);
    console.log(dataForW);

    this.lineChartWhite.update();
    this.lineChartBlack.update();
  }

}
