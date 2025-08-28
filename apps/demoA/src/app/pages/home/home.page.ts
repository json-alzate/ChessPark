import { Component,  CUSTOM_ELEMENTS_SCHEMA, inject, ViewChild, AfterViewInit } from '@angular/core';
import {  IonContent, IonGrid, IonRow, IonIcon, IonCol, IonCard, IonRippleEffect } from '@ionic/angular/standalone';
import { Router, ActivatedRoute } from '@angular/router';

import { ThemeSelectorComponent } from '../../shared/components/theme-selector/theme-selector.component';
import { ThemeApplyDirective } from '../../shared/directives/theme-apply.directive';
import { LineChartComponent } from '../../shared/components/line-chart/line-chart.component';

import { addIcons } from 'ionicons';
import { listOutline, gridOutline, albumsOutline } from 'ionicons/icons';
import { DecimalPipe } from '@angular/common';

import { ActiveLoadingComponent, ListenLoadingComponent, CancelLoadingComponent } from '@xerpa/widgets';
import { XerpaWidgetGoalListComponent } from '@xerpa/widgets';

import { UiFacadeService, GoalsFacadeService } from '@xerpa/state';
import { DataService } from '../../services/data.service';
import { AssetService } from '../../services/asset.service';
import { XerpaGoal } from '@xerpa/models';
import { NavigationService } from '../../services/navigation.service';


@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [IonIcon, IonRow, IonGrid, IonCol, IonCard, IonRippleEffect,  IonContent, ThemeSelectorComponent, ThemeApplyDirective, DecimalPipe, ActiveLoadingComponent, ListenLoadingComponent, CancelLoadingComponent, XerpaWidgetGoalListComponent, LineChartComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class HomePage implements AfterViewInit {
  @ViewChild('swiperContainer') swiperContainer: any;
  private router = inject(Router);
  private uiFacade = inject(UiFacadeService);
  private dataService = inject(DataService);
  public assetService = inject(AssetService);
  private route = inject(ActivatedRoute);
  private goalsFacade = inject(GoalsFacadeService);
  private navigationService = inject(NavigationService);

  viewMode: 'grid' | 'list' | 'slide' = 'grid';

  lineChartLabels = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio'];
  lineChartData = [3200, 3500, 4000, 4200, 4100, 4300];


  goals = [
    {
      id: '1',
      project_name: 'Comprar Casa',
      description: 'Ahorro para la casa propia',
      type: 'casa',
      total: 200000,
      amountSaved: 45000,
      end_date: 1719878400000, // ejemplo timestamp
      from_account: 'Cuenta Nómina BBVA',
      to_account: 'Cuenta Ahorro Santander',
      created_at: 1710000000000,
      porcentaje: 22.5,
      progressClass: 'progress-primary',
    },
    {
      id: '2',
      project_name: 'Compras Especiales',
      description: 'Compras de tecnología',
      type: 'compras',
      total: 15000,
      amountSaved: 8500,
      end_date: 1720000000000,
      from_account: 'Cuenta Corriente Banamex',
      to_account: 'Cuenta Ahorro Santander',
      created_at: 1710000000001,
      porcentaje: 56.7,
      progressClass: 'progress-success',
    },
    {
      id: '3',
      project_name: 'Pagar Deudas',
      description: 'Pago de tarjeta de crédito',
      type: 'deudas',
      total: 25000,
      amountSaved: 12300,
      end_date: 1725000000000,
      from_account: 'Cuenta Nómina BBVA',
      to_account: 'Cuenta Corriente Banamex',
      created_at: 1710000000002,
      porcentaje: 49.2,
      progressClass: 'progress-warning',
    },
    {
      id: '4',
      project_name: 'Estudios Superiores',
      description: 'Maestría en el extranjero',
      type: 'educacion',
      total: 50000,
      amountSaved: 3200,
      end_date: 1730000000000,
      from_account: 'Cuenta Ahorro Santander',
      to_account: 'Cuenta Nómina BBVA',
      created_at: 1710000000003,
      porcentaje: 6.4,
      progressClass: 'progress-info',
    },
    {
      id: '5',
      project_name: 'Viaje de Ensueño',
      description: 'Viaje a Europa',
      type: 'viaje',
      total: 30000,
      amountSaved: 18750,
      end_date: 1735000000000,
      from_account: 'Cuenta Corriente Banamex',
      to_account: 'Cuenta Ahorro Santander',
      created_at: 1710000000004,
      porcentaje: 62.5,
      progressClass: 'progress-secondary',
    },
    {
      id: '6',
      project_name: 'Nuevo Vehículo',
      description: 'Compra de auto nuevo',
      type: 'vehiculo',
      total: 35000,
      amountSaved: 7800,
      end_date: 1740000000000,
      from_account: 'Cuenta Nómina BBVA',
      to_account: 'Cuenta Corriente Banamex',
      created_at: 1710000000005,
      porcentaje: 22.3,
      progressClass: 'progress-accent',
    },
  ];

  isSimulatingLoading = false;
  setViewMode(mode: 'grid' | 'list' | 'slide') {
    this.viewMode = mode;
  }

  constructor() {
    addIcons({ listOutline, gridOutline, albumsOutline });
    this.route.queryParams.subscribe(params => {
      if (params['refresh']) {
        this.refreshGoals();
      }
    });
  }

  ngOnInit() {
    this.refreshGoals();
    // Cargar metas locales en el estado de NgRx solo la primera vez
    this.goalsFacade.getGoals$().subscribe(goalsState => {
      if (goalsState.length === 0) {
        const storedGoals = this.dataService.getGoals();
        for (const goal of storedGoals) {
          this.goalsFacade.addGoal(goal);
        }
      }
    });
  }

  ngAfterViewInit() {
    if (this.swiperContainer?.nativeElement) {
      this.swiperContainer.nativeElement.addEventListener('slidechange', (event: any) => {
        // Aquí puedes manejar el cambio de slide si lo necesitas
        // Por ejemplo: console.log('Slide activo:', event.detail[0].activeIndex);
      });
    }
  }

  refreshGoals() {
    const storedGoals = this.dataService.getGoals().map(goal => ({
      ...goal,
      porcentaje: typeof goal.porcentaje === 'number' ? goal.porcentaje : (goal.total > 0 ? Math.round((goal.amountSaved / goal.total) * 100) : 0),
      progressClass: goal.progressClass || this.getProgressClass(goal)
    }));
    
    // Combinar metas almacenadas con metas por defecto
    const allGoals = [
      ...storedGoals,
      ...this.goals.filter(g => !storedGoals.some(sg => sg.id === g.id))
    ];
    
    // Ordenar por fecha de creación (más reciente primero)
    this.goals = allGoals.sort((a, b) => {
      const dateA = a.created_at || 0;
      const dateB = b.created_at || 0;
      return dateB - dateA; // Orden descendente (más reciente primero)
    });
  }

  getProgressClass(goal: { porcentaje?: number; total: number; amountSaved: number; }): string {
    const porcentaje = typeof goal.porcentaje === 'number' ? goal.porcentaje : (goal.total > 0 ? Math.round((goal.amountSaved / goal.total) * 100) : 0);
    if (porcentaje >= 80) return 'progress-success';
    if (porcentaje >= 50) return 'progress-info';
    if (porcentaje >= 30) return 'progress-warning';
    if (porcentaje >= 10) return 'progress-secondary';
    if (porcentaje > 0) return 'progress-accent';
    return 'progress-primary';
  }

  createGoal() {
  this.router.navigate(['/create-goal']);
  }

  onSimulateLoading() {
    this.isSimulatingLoading = true;
    this.uiFacade.activeLoadingAction();
  }
  onStopSimulateLoading() {
    this.isSimulatingLoading = false;
    this.uiFacade.stopLoadingAction();
  }

  onRefreshGoals() {
    this.refreshGoals();
  }
}
