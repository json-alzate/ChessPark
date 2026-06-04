import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import {
  IonContent,
  IonIcon,
  AlertController,
} from '@ionic/angular/standalone';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { Plan, Block } from '@cpark/models';

import { PlanStorageService } from '@services/plan-storage.service';
import { PlanFacadeService } from '@cpark/state';
import { AppService } from '@services/app.service';
import { SecondsToMinutesSecondsPipe } from '@chesspark/common-utils';

import { NavbarComponent } from '@shared/components/navbar/navbar.component';

import { addIcons } from 'ionicons';
import {
  timeOutline,
  eyeOutline,
  trashOutline,
  calendarOutline,
  statsChartOutline,
  extensionPuzzleOutline,
  shuffle,
  trendingDown,
  infiniteOutline,
  flame,
  flameOutline,
} from 'ionicons/icons';

@Component({
  selector: 'app-plans-history',
  standalone: true,
  imports: [
    CommonModule,
    TranslocoPipe,
    IonContent,
    IonIcon,
    NavbarComponent,
    SecondsToMinutesSecondsPipe,
  ],
  templateUrl: './plans-history.component.html',
  styleUrl: './plans-history.component.scss',
})
export class PlansHistoryComponent implements OnInit, OnDestroy {
  private planStorageService = inject(PlanStorageService);
  private planFacade = inject(PlanFacadeService);
  private router = inject(Router);
  private alertController = inject(AlertController);
  public appService = inject(AppService);
  private translocoService = inject(TranslocoService);

  private destroy$ = new Subject<void>();

  plans: Plan[] = [];
  groupedPlans: { date: string; plans: Plan[] }[] = [];
  isLoading = false;
  streakDays = 0;
  isStreakActive = false;

  constructor() {
    addIcons({
      timeOutline,
      eyeOutline,
      trashOutline,
      calendarOutline,
      statsChartOutline,
      extensionPuzzleOutline,
      shuffle,
      trendingDown,
      infiniteOutline,
      flame,
      flameOutline,
    });
  }

  ngOnInit(): void {
    this.loadPlans();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Carga todos los planes desde el almacenamiento local
   */
  loadPlans(): void {
    this.isLoading = true;
    try {
      this.plans = this.planStorageService.getAllPlans().filter(p => p.planType !== 'reto333');
      // TEMP_SCREENSHOTS: datos fake para capturas de las tiendas — ELIMINAR después
      this.plans = [...this.generateFakePlans(), ...this.plans].sort(
        (a, b) => b.createdAt - a.createdAt
      );
      // FIN TEMP_SCREENSHOTS
      this.groupPlansByDate();
      this.calculateStreak();
      // TEMP_SCREENSHOTS: racha fija para captura — ELIMINAR después
      this.streakDays = 12;
      this.isStreakActive = true;
      // FIN TEMP_SCREENSHOTS
    } catch (error) {
      console.error('Error al cargar planes:', error);
      this.plans = [];
      this.groupedPlans = [];
    } finally {
      this.isLoading = false;
    }
  }

  // ============================================================
  // TEMP_SCREENSHOTS: generación de datos fake para las capturas
  // de las tiendas. ELIMINAR este método y sus llamadas después.
  // ============================================================
  private generateFakePlans(): Plan[] {
    const DAY = 24 * 60 * 60 * 1000;
    const now = Date.now();

    const buildPuzzles = (total: number, correct: number): Block['puzzlesPlayed'] => {
      return Array.from({ length: total }, (_, i) => ({
        resolved: i < correct,
      })) as Block['puzzlesPlayed'];
    };

    const buildBlock = (
      theme: string,
      description: string,
      time: number,
      total: number,
      correct: number,
      elo: number
    ): Block => ({
      description,
      time,
      puzzlesCount: total,
      theme,
      elo,
      color: 'random',
      puzzlesPlayed: buildPuzzles(total, correct),
    });

    type Spec = {
      dayOffset: number;
      hour: number;
      planType: Plan['planType'];
      title?: string;
      eloTotal: number;
      blocks: Block[];
    };

    const specs: Spec[] = [
      {
        dayOffset: 0,
        hour: 9,
        planType: 'warmup',
        eloTotal: 1320,
        blocks: [buildBlock('mateIn1', 'Mate en 1', 180, 12, 11, 1280)],
      },
      {
        dayOffset: 0,
        hour: 19,
        planType: 'plan10',
        eloTotal: 1410,
        blocks: [
          buildBlock('fork', 'Tenedor', 300, 18, 15, 1380),
          buildBlock('pin', 'Clavada', 300, 16, 13, 1440),
        ],
      },
      {
        dayOffset: 1,
        hour: 8,
        planType: 'plan5',
        eloTotal: 1290,
        blocks: [buildBlock('mateIn2', 'Mate en 2', 300, 14, 11, 1290)],
      },
      {
        dayOffset: 1,
        hour: 21,
        planType: 'custom',
        title: 'Rutina de finales',
        eloTotal: 1465,
        blocks: [
          buildBlock('endgame', 'Finales', 240, 10, 9, 1450),
          buildBlock('rookEndgame', 'Finales de torre', 240, 8, 6, 1480),
        ],
      },
      {
        dayOffset: 2,
        hour: 18,
        planType: 'plan20',
        eloTotal: 1380,
        blocks: [
          buildBlock('discoveredAttack', 'Ataque descubierto', 600, 22, 18, 1360),
          buildBlock('mateIn2', 'Mate en 2', 600, 20, 16, 1400),
        ],
      },
      {
        dayOffset: 3,
        hour: 20,
        planType: 'plan3',
        eloTotal: 1255,
        blocks: [buildBlock('mateIn1', 'Mate en 1', 180, 9, 8, 1255)],
      },
      {
        dayOffset: 4,
        hour: 17,
        planType: 'custom',
        title: 'Tácticas de apertura',
        eloTotal: 1510,
        blocks: [buildBlock('opening', 'Apertura', 420, 15, 13, 1510)],
      },
      {
        dayOffset: 5,
        hour: 10,
        planType: 'plan10',
        eloTotal: 1430,
        blocks: [
          buildBlock('skewer', 'Brocheta', 300, 17, 14, 1420),
          buildBlock('fork', 'Tenedor', 300, 19, 17, 1440),
        ],
      },
      {
        dayOffset: 6,
        hour: 19,
        planType: 'plan30',
        eloTotal: 1395,
        blocks: [
          buildBlock('mateIn2', 'Mate en 2', 600, 24, 19, 1370),
          buildBlock('pin', 'Clavada', 600, 21, 17, 1410),
          buildBlock('fork', 'Tenedor', 600, 23, 20, 1405),
        ],
      },
    ];

    return specs.map((spec, index) => ({
      uid: `fake-screenshot-${index}`,
      title: spec.title,
      eloTotal: spec.eloTotal,
      blocks: spec.blocks,
      createdAt: now - spec.dayOffset * DAY - (24 - spec.hour) * 60 * 60 * 1000,
      planType: spec.planType,
      isFinished: true,
    }));
  }
  // ============================================================
  // FIN TEMP_SCREENSHOTS
  // ============================================================

  /**
   * Calcula la racha actual de días consecutivos con planes completados
   */
  calculateStreak(): void {
    if (this.plans.length === 0) {
      this.streakDays = 0;
      this.isStreakActive = false;
      return;
    }

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Obtener fechas únicas ordenadas descending
    const uniqueDates = Array.from(
      new Set(
        this.plans.map((plan) => {
          const date = new Date(plan.createdAt);
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
            2,
            '0'
          )}-${String(date.getDate()).padStart(2, '0')}`;
        })
      )
    ).sort((a, b) => b.localeCompare(a));

    const hasPlanToday = uniqueDates[0] === todayStr;

    if (!hasPlanToday) {
      this.isStreakActive = false;
      this.streakDays = 0;
      return;
    }

    this.isStreakActive = true;

    let days = 0;
    let currentDate = new Date(today);

    // Contar días consecutivos hacia atrás desde hoy
    while (true) {
      const expectedStr = `${currentDate.getFullYear()}-${String(
        currentDate.getMonth() + 1
      ).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
      if (uniqueDates.includes(expectedStr)) {
        days++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }

    this.streakDays = days;
  }

  /**
   * Agrupa los planes por fecha
   */
  groupPlansByDate(): void {
    const grouped = new Map<string, Plan[]>();

    this.plans.forEach((plan) => {
      const dateKey = this.formatDate(plan.createdAt);
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(plan);
    });

    // Convertir a array y ordenar por fecha (más recientes primero)
    this.groupedPlans = Array.from(grouped.entries())
      .map(([date, plans]) => ({ date, plans }))
      .sort((a, b) => {
        // Ordenar por la fecha del primer plan de cada grupo
        const dateA = a.plans[0]?.createdAt || 0;
        const dateB = b.plans[0]?.createdAt || 0;
        return dateB - dateA;
      });
  }

  /**
   * Obtiene el nombre del tipo de plan para mostrar
   */
  getPlanTypeName(planType: Plan['planType']): string {
    // Usar el servicio de app para obtener el nombre traducido si está disponible
    // Por ahora, usar nombres en español como fallback
    const typeNames: Record<Plan['planType'], string> = {
      warmup: 'Calentamiento',
      plan1: 'Plan 1',
      plan3: 'Plan 3',
      plan5: 'Plan 5',
      plan10: 'Plan 10',
      plan20: 'Plan 20',
      plan30: 'Plan 30',
      backToCalm: 'Vuelta a la calma',
      custom: 'Personalizado',
      infinity: 'Infinito',
      reto333: 'Reto 333',
    };
    return typeNames[planType] || planType;
  }

  /**
   * Formatea la fecha de creación del plan
   */
  formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return this.translocoService.translate('PLANS_HISTORY.today');
    } else if (diffDays === 1) {
      return this.translocoService.translate('PLANS_HISTORY.yesterday');
    } else if (diffDays < 7) {
      return this.translocoService.translate('PLANS_HISTORY.daysAgo', {
        days: diffDays,
      });
    } else {
      const locale =
        this.translocoService.getActiveLang() === 'en' ? 'en-US' : 'es-ES';
      return date.toLocaleDateString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
  }

  /**
   * Calcula el número total de puzzles jugados en un plan
   */
  getTotalPuzzlesPlayed(plan: Plan): number {
    return plan.blocks.reduce((total, block) => {
      return total + (block.puzzlesPlayed?.length || 0);
    }, 0);
  }

  /**
   * Navega a la página de detalles del plan
   */
  viewPlanDetails(plan: Plan): void {
    // Actualizar el plan en Redux para que plan-played lo pueda leer
    this.planFacade.updatePlan(plan);
    // También pasar el uid como query param por si acaso
    this.router.navigate(['/puzzles/plan-played'], {
      queryParams: { uid: plan.uid },
    });
  }

  /**
   * Elimina un plan del historial
   */
  async deletePlan(plan: Plan, event: Event): Promise<void> {
    event.stopPropagation(); // Evitar que se active el click del card

    const alert = await this.alertController.create({
      header: 'Eliminar plan',
      message: '¿Estás seguro de que deseas eliminar este plan del historial?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => {
            this.planStorageService.deletePlan(plan.uid);
            this.loadPlans(); // Recargar la lista y reagrupar
          },
        },
      ],
    });

    await alert.present();
  }

  /**
   * Calcula el porcentaje de puzzles resueltos correctamente
   */
  getSuccessRate(plan: Plan): number {
    const totalPuzzles = this.getTotalPuzzlesPlayed(plan);
    if (totalPuzzles === 0) return 0;

    const correctPuzzles = plan.blocks.reduce((total, block) => {
      return (
        total + (block.puzzlesPlayed?.filter((p) => p.resolved).length || 0)
      );
    }, 0);

    return Math.round((correctPuzzles / totalPuzzles) * 100);
  }

  /**
   * Calcula el tiempo total del plan en segundos
   */
  getTotalTime(plan: Plan): number {
    return plan.blocks.reduce((total, block) => {
      return total + (block.time > 0 ? block.time : 0);
    }, 0);
  }

  /**
   * Obtiene la configuración del bloque para mostrar
   */
  getBlockConfig(
    block: Block
  ): {
    type: 'time' | 'puzzles' | 'both' | 'infinite';
    time?: number;
    puzzles?: number;
  } | null {
    const hasTime = block.time > 0;
    const hasPuzzles = block.puzzlesCount > 0;

    if (hasTime && hasPuzzles) {
      return { type: 'both', time: block.time, puzzles: block.puzzlesCount };
    } else if (hasTime) {
      return { type: 'time', time: block.time };
    } else if (hasPuzzles) {
      return { type: 'puzzles', puzzles: block.puzzlesCount };
    } else {
      return { type: 'infinite' };
    }
  }

  /**
   * Obtiene el nombre del tema
   */
  getThemeName(theme: string): string {
    return this.appService.getNameThemePuzzleByValue(theme);
  }

  /**
   * Obtiene el icono del tema
   */
  getThemeIcon(
    theme: string
  ): { type: 'icon' | 'image'; value: string } | null {
    if (theme === 'all') {
      return { type: 'icon', value: 'shuffle' };
    }
    if (theme === 'weakness') {
      return { type: 'icon', value: 'trending-down' };
    }
    const themeData = this.appService.getThemePuzzleByValue(theme);
    if (themeData?.img) {
      return {
        type: 'image',
        value: `/assets/images/puzzle-themes/${themeData.img}`,
      };
    }
    return null;
  }

  /**
   * Navega al inicio
   */
  goToHome(): void {
    this.router.navigate(['/home']);
  }
}
