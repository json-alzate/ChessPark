import { Component, OnInit, Input, AfterViewInit, ViewChild, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';

import { Chart, registerables } from 'chart.js';

import { Profile, Plan, PlanElos } from '@cpark/models';

import { AppService } from '@services/app.service';
import { ProfileService } from '@services/profile.service';
import { PlansElosService } from '@services/plans-elos.service';

@Component({
  selector: 'app-plan-chart',
  standalone: true,
  imports: [CommonModule, TranslocoPipe],
  templateUrl: './plan-chart.component.html',
  styleUrl: './plan-chart.component.scss',
})
export class PlanChartComponent implements OnInit, AfterViewInit {
  @ViewChild('themesUpCanvas', { static: false }) themesUpCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('themesDownCanvas', { static: false }) themesDownCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('openingsUpCanvas', { static: false }) openingsUpCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('openingsDownCanvas', { static: false }) openingsDownCanvas!: ElementRef<HTMLCanvasElement>;

  @Input() plan!: Plan;
  @Input() isModal = false;
  @Input() showEloPlanHeader = true;

  private profileService = inject(ProfileService);
  private appService = inject(AppService);
  private plansElosService = inject(PlansElosService);

  themeChart: Chart | null = null;
  openingChart: Chart | null = null;

  profile: Profile | null = null;
  totalElo = 1500;
  themesLabels: string[] = [];
  themesElos: number[] = [];
  openingsLabels: string[] = [];
  openingsElos: number[] = [];

  segment: 'themesUp' | 'themesDown' | 'themesItems' | 'openingsUp' | 'openingsDown' | 'openingsItems' = 'themesUp';

  options = {
    responsive: true,
    maintainAspectRatio: false,
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
          callback: function (value: any) {
            return value.toString();
          }
        }
      }
    }
  };

  constructor() {
    Chart.register(...registerables);
  }

  ngOnInit() {
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.getElos();
    }, 3000);
  }

  async getElos() {
    this.profileService.subscribeToProfile().subscribe(profile => {
      this.profile = profile;
    });

    let elos: { [key: string]: number };
    let openings: { [key: string]: number };

    if (this.plan.planType === 'custom' && this.plan.uidCustomPlan) {
      const planElos: PlanElos = await this.plansElosService.getOnePlanElo(this.plan.uidCustomPlan);
      elos = planElos.themes || {};
      openings = planElos.openings || {};
      this.totalElo = planElos.total || 1500;
    } else {
      elos = this.profileService.getElosThemesByPlanType(this.plan.planType);

      console.log('elos ', JSON.stringify(elos), 'planType ', this.plan.planType);
      this.totalElo = this.profileService.getEloTotalByPlanType(this.plan.planType);
      openings = this.profileService.getElosOpeningsByPlanType(this.plan.planType);
    }

    // ordenar elos de mayor a menor
    const elosShort = Object.entries(elos).sort((a, b) => b[1] - a[1]);
    const openingsShort = Object.entries(openings).sort((a, b) => b[1] - a[1]);

    // Limpiar arrays
    this.themesLabels = [];
    this.themesElos = [];
    this.openingsLabels = [];
    this.openingsElos = [];

    elosShort.forEach(([key, value]) => {
      this.themesLabels.push(this.appService.getNameThemePuzzleByValue(key) || key);
      this.themesElos.push(value);
    });

    openingsShort.forEach(([key, value]) => {
      this.openingsLabels.push(this.appService.getNameOpeningByValue(key) || key);
      this.openingsElos.push(value);
    });

    // Construir todos los gráficos después de un pequeño delay para asegurar que los canvas estén renderizados
    setTimeout(() => {
      this.buildThemesUpChart();
      this.buildThemesDownChart();
      this.buildOpeningsUpChart();
      this.buildOpeningsDownChart();
    }, 100);
  }

  buildThemesUpChart() {
    if (!this.themesUpCanvas?.nativeElement) {
      return;
    }

    this.themeChart = new Chart(this.themesUpCanvas.nativeElement, {
      type: 'radar',
      data: {
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
    if (!this.themesDownCanvas?.nativeElement) {
      return;
    }

    this.themeChart = new Chart(this.themesDownCanvas.nativeElement, {
      type: 'radar',
      data: {
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
    if (!this.openingsUpCanvas?.nativeElement) {
      return;
    }

    this.openingChart = new Chart(this.openingsUpCanvas.nativeElement, {
      type: 'radar',
      data: {
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
    if (!this.openingsDownCanvas?.nativeElement) {
      return;
    }

    this.openingChart = new Chart(this.openingsDownCanvas.nativeElement, {
      type: 'radar',
      data: {
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

  setSegment(segment: typeof this.segment) {
    this.segment = segment;
  }
}

