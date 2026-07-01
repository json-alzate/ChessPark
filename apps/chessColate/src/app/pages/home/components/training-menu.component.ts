import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectorRef,
  inject,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';

import {
  IonRippleEffect,
  IonIcon,
  LoadingController,
} from '@ionic/angular/standalone';

// services
import { BlockService } from '@services/block.service';
import { PlanService } from '@services/plan.service';
import { ProfileService } from '@services/profile.service';

import { addIcons } from 'ionicons';
import {
  timerOutline,
  flashOutline,
  flameOutline,
  speedometerOutline,
  hourglassOutline,
} from 'ionicons/icons';
import { Block, Plan, PlanTypes } from '@cpark/models';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  CATEGORY_ICON,
  TRAINING_PLAN_PRESETS,
  TrainingBlockPreset,
  TrainingPlanPreset,
} from './training-plans.config';

@Component({
  selector: 'app-training-menu',
  imports: [CommonModule, IonRippleEffect, IonIcon, TranslocoPipe],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './training-menu.component.html',
  styleUrl: './training-menu.component.scss',
})
export class TrainingMenuComponent implements OnInit, OnDestroy {
  private blockService = inject(BlockService);
  private planService = inject(PlanService);
  private profileService = inject(ProfileService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private translocoService = inject(TranslocoService);
  private destroy$ = new Subject<void>();

  readonly presets: TrainingPlanPreset[] = TRAINING_PLAN_PRESETS;

  /** Bloques mostrados directamente en la tarjeta; el resto va al popover. */
  readonly maxVisibleBlocks = 2;

  /** Slots fijos de la lista (reservan alto para que todas las tarjetas midan igual). */
  readonly blockSlots = Array.from({ length: this.maxVisibleBlocks }, (_, i) => i);

  /** Rutina recomendada por defecto: 10 min, el "daily driver" completo sin agotar. */
  readonly recommendedPlan = 10;
  readonly recommendedIndex = this.presets.findIndex(
    (p) => p.plan === this.recommendedPlan
  );

  /** Índice de la tarjeta activa en el slider mobile (arranca en la recomendada). */
  activeSlide = this.recommendedIndex;

  constructor(private loadingController: LoadingController) {
    addIcons({
      timerOutline,
      flashOutline,
      flameOutline,
      speedometerOutline,
      hourglassOutline,
    });
  }

  ngOnInit(): void {
    this.profileService.profile$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.cdr.markForCheck());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ---- Slider mobile --------------------------------------------------------

  /** Sincroniza el indicador de dots con la tarjeta visible del slider. */
  onSlideChange(event: Event): void {
    const [swiper] = (event as CustomEvent).detail;
    this.activeSlide = swiper.activeIndex;
    this.cdr.markForCheck();
  }

  // ---- Presentación de la tarjeta -------------------------------------------

  categoryIconFor(preset: TrainingPlanPreset): string {
    return CATEGORY_ICON[preset.category];
  }

  isRecommended(preset: TrainingPlanPreset): boolean {
    return preset.plan === this.recommendedPlan;
  }

  hiddenBlocks(preset: TrainingPlanPreset): TrainingBlockPreset[] {
    return preset.blocks.slice(this.maxVisibleBlocks);
  }

  /** Duración en formato m:ss. */
  formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ---- ELO ------------------------------------------------------------------

  isEloProvisional(planNumber: number): boolean {
    return !this.hasRegisteredEloForPlan(planNumber);
  }

  getEloDisplayForPlan(planNumber: number): string {
    const elo = this.getEloForPlan(planNumber);
    const isProvisional = !this.hasRegisteredEloForPlan(planNumber);
    return isProvisional ? `${elo}?` : `${elo}`;
  }

  private getEloForPlan(planNumber: number): number {
    if (!this.profileService.getProfile?.uid) {
      return 1500;
    }
    const planType = `plan${planNumber}` as PlanTypes;
    return this.profileService.getEloTotalByPlanType(planType);
  }

  private hasRegisteredEloForPlan(planNumber: number): boolean {
    const profile = this.profileService.getProfile;
    if (!profile?.uid || !profile.elos) {
      return false;
    }
    const totalKey = `plan${planNumber}Total` as keyof typeof profile.elos;
    const total = profile.elos[totalKey];
    return typeof total === 'number';
  }

  // ---- Creación de la rutina ------------------------------------------------

  async createPlan(planNumber: number) {
    const planType = `plan${planNumber}` as PlanTypes;

    const loader = await this.loadingController.create({
      message: this.translocoService.translate('PUZZLES.loader.creatingRoutine'),
    });
    await loader.present();

    try {
      const blocks: Block[] = await this.blockService.generateBlocksForPlan(planType);

      // Cargar puzzles de todos los bloques en paralelo
      const total = blocks.length;
      let loaded = 0;

      const puzzlePromises = blocks.map(async (block) => {
        const puzzles = await this.blockService.getPuzzlesForBlock(block);
        block.puzzles = puzzles;
        loaded++;

        // Actualizar el mensaje de progreso
        if (loader) {
          loader.message = this.translocoService.translate(
            'PUZZLES.loader.loadingPuzzlesProgress',
            { loaded, total }
          );
        }

        return block;
      });

      await Promise.all(puzzlePromises);

      const newPlan: Plan = await this.planService.newPlan(blocks, planType);
      console.log('newPlan', newPlan);

      await loader.dismiss();

      this.router.navigate(['/puzzles/training']);
    } catch (error) {
      await loader.dismiss();
      console.error('Error al crear el plan:', error);
      // Aquí podrías mostrar un mensaje de error al usuario
    }
  }
}
