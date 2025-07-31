//core and third party libraries
import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { Chart, registerables } from 'chart.js';


@Component({
  selector: 'app-statics',
  templateUrl: './statics.component.html',
  styleUrls: ['./statics.component.scss'],
})
export class StaticsComponent implements OnInit, AfterViewInit {

  @ViewChild('lineCanvas') lineCanvas;
  lineChart: Chart;

  dataset = new Array(50).fill(0);

  constructor() {
    Chart.register(...registerables);
  }

  ngOnInit() { }

  ngAfterViewInit() {
    this.lineChartMethod();
  }


  lineChartMethod() {

    this.lineChart = new Chart(this.lineCanvas.nativeElement, {
      type: 'line',
      data: {
        labels: new Array(20).fill(''), // genera '' * 20
        datasets: [
          {
            label: '',
            data: this.dataset,
            backgroundColor: 'rgba(66,140,255, 0.2)',
            borderColor: 'rgba(66,140,255, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true
      }
    });



  }

}
