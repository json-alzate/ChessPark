import { Component, OnInit, Input, AfterViewInit, ViewChild } from '@angular/core';

import { ModalController } from '@ionic/angular';

import { Chart, registerables } from 'chart.js';


import { Profile } from '@models/profile.model';
import { Plan } from '@models/plan.model';
import { PlanElos } from '@models/planElos.model';

import { AppService } from '@services/app.service';
import { ProfileService } from '@services/profile.service';
import { PlansElosService } from '@services/plans-elos.service';


@Component({
  selector: 'app-plan-chart',
  templateUrl: './plan-chart.component.html',
  styleUrls: ['./plan-chart.component.scss'],
})
export class PlanChartComponent implements OnInit, AfterViewInit {

  @ViewChild('themesUpCanvas') themesUpCanvas;
  @ViewChild('themesDownCanvas') themesDownCanvas;
  @ViewChild('openingsUpCanvas') openingsUpCanvas;
  @ViewChild('openingsDownCanvas') openingsDownCanvas;

  @Input() plan: Plan;
  @Input() isModal: boolean;
  @Input() showEloPlanHeader = true;

  themeChart: Chart;
  openingChart: Chart;

  profile: Profile;
  totalElo = 1500;
  themesLabels: string[] = [];
  themesElos: number[] = [];
  openingsLabels: string[] = [];
  openingsElos: number[] = [];

  segment = 'themesUp';

  options = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      }
    },
    scales: {
      r: {
        angleLines: {
          color: '#bf811c',
        },
        ticks: {
          color: 'white',
          backdropColor: 'transparent',
        }
      }
    }
  };

  constructor(
    private modalController: ModalController,
    private profileService: ProfileService,
    private appService: AppService,
    private plansElosService: PlansElosService
  ) {
    Chart.register(...registerables);

  }

  ngOnInit() {

  }

  ngAfterViewInit() {
    this.getElos();

  }

  async getElos() {
    this.profileService.subscribeToProfile().pipe().subscribe(profile => {
      this.profile = profile;
    });
    let elos: { [key: string]: number };
    let openings: { [key: string]: number };

    if (this.plan.planType === 'custom') {
      const planElos: PlanElos = await this.plansElosService.getOnePlanElo(this.plan.uidCustomPlan);
      elos = planElos.themes;
      openings = planElos.openings;
      this.totalElo = planElos.total;
    } else {
      elos = this.profileService.getElosThemesByPlanType(this.plan.planType);
      this.totalElo = this.profileService.getEloTotalByPlanType(this.plan.planType);
      openings = this.profileService.getElosOpeningsByPlanType(this.plan.planType);
    }


    // ordenar elos de mayor a menor
    const elosShort = Object.entries(elos).sort((a, b) => b[1] - a[1]);
    const openingsShort = Object.entries(openings).sort((a, b) => b[1] - a[1]);

    // get from shortened object

    elosShort.forEach(([key, value]) => {
      this.themesLabels = [...this.themesLabels, this.appService.getNameThemePuzzleByValue(key) || key];
      this.themesElos = [...this.themesElos, value];
    });




    openingsShort.forEach(([key, value]) => {
      this.openingsLabels = [...this.openingsLabels, this.appService.getNameOpeningByValue(key) || key];
      this.openingsElos = [...this.openingsElos, value];
    });

    this.buildThemesUpChart();
    this.buildThemesDownChart();
    this.buildOpeningsUpChart();
    this.buildOpeningsDownChart();
  }

  buildThemesUpChart() {
    this.themeChart = new Chart(this.themesUpCanvas.nativeElement, {
      type: 'radar',
      data: {
        // se obtienen los primeros 7 elementos
        labels: this.themesLabels.slice(0, 7),
        datasets: [
          {
            label: 'Elo',
            data: this.themesElos.slice(0, 7),
            backgroundColor: 'rgba(47, 223, 117, 0.2)',
            borderColor: 'rgba(41, 196, 103, 0.2)',
            borderWidth: 1,
          }
        ]
      },
      options: this.options
    });

  }

  buildThemesDownChart() {
    this.themeChart = new Chart(this.themesDownCanvas.nativeElement, {
      type: 'radar',
      data: {
        // se obtienen los últimos 7 elementos
        labels: this.themesLabels.slice(-7),
        datasets: [
          {
            label: 'Elo',
            data: this.themesElos.slice(-7),
            backgroundColor: 'rgba(255, 73, 97, 0.2)',
            borderColor: 'rgba(224, 64, 85, 0.2)',
            borderWidth: 1,
          }
        ]
      },
      options: this.options
    });
  }

  buildOpeningsUpChart() {

    this.openingChart = new Chart(this.openingsUpCanvas.nativeElement, {
      type: 'radar',
      data: {
        // se obtienen los primeros 7 elementos
        labels: this.openingsLabels.slice(0, 7),
        datasets: [
          {
            label: 'Elo',
            data: this.openingsElos.slice(0, 7),
            backgroundColor: 'rgba(47, 223, 117, 0.2)',
            borderColor: 'rgba(41, 196, 103, 0.2)',
            borderWidth: 1,
          }
        ]
      },
      options: this.options
    });
  }

  buildOpeningsDownChart() {

    this.openingChart = new Chart(this.openingsDownCanvas.nativeElement, {
      type: 'radar',
      data: {
        // se obtienen los últimos 7 elementos
        labels: this.openingsLabels.slice(-7),
        datasets: [
          {
            label: 'Elo',
            data: this.openingsElos.slice(-7),
            backgroundColor: 'rgba(255, 73, 97, 0.2)',
            borderColor: 'rgba(224, 64, 85, 0.2)',
            borderWidth: 1,
          }
        ]
      },
      options: this.options
    });
  }

  close() {
    this.modalController.dismiss();
  }

}
