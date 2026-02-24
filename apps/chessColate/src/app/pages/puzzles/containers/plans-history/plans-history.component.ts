import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { IonContent, IonIcon, AlertController } from '@ionic/angular/standalone';
import { TranslocoPipe } from '@jsverse/transloco';

import { Plan } from '@cpark/models';

import { PlanStorageService } from '@services/plan-storage.service';
import { PlanFacadeService } from '@cpark/state';
import { AppService } from '@services/app.service';

import { NavbarComponent } from '@shared/components/navbar/navbar.component';

import { addIcons } from 'ionicons';
import {
    timeOutline,
    eyeOutline,
    trashOutline,
    calendarOutline,
    statsChartOutline,
    extensionPuzzleOutline
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

    private destroy$ = new Subject<void>();

    plans: Plan[] = [];
    isLoading = false;

    constructor() {
        addIcons({
            timeOutline,
            eyeOutline,
            trashOutline,
            calendarOutline,
            statsChartOutline,
            extensionPuzzleOutline
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
            this.plans = this.planStorageService.getAllPlans();
        } catch (error) {
            console.error('Error al cargar planes:', error);
            this.plans = [];
        } finally {
            this.isLoading = false;
        }
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
            return 'Hoy';
        } else if (diffDays === 1) {
            return 'Ayer';
        } else if (diffDays < 7) {
            return `Hace ${diffDays} días`;
        } else {
            return date.toLocaleDateString('es-ES', {
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
        this.router.navigate(['/puzzles/plan-played'], { queryParams: { uid: plan.uid } });
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
                        this.loadPlans(); // Recargar la lista
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
            return total + (block.puzzlesPlayed?.filter(p => p.resolved).length || 0);
        }, 0);

        return Math.round((correctPuzzles / totalPuzzles) * 100);
    }
}
