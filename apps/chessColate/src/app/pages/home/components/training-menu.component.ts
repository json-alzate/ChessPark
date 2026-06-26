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
  IonPopover,
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
  BLOCK_COLORS,
  CATEGORY_ICON,
  TRAINING_PLAN_PRESETS,
  TrainingBlockPreset,
  TrainingPlanPreset,
} from './training-plans.config';

/** Un tramo coloreado de la línea de intensidad (un bloque). */
interface IntensitySegment {
  points: string;
  color: string;
}

@Component({
  selector: 'app-training-menu',
  imports: [CommonModule, IonRippleEffect, IonIcon, IonPopover, TranslocoPipe],
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

  // Geometría de la mini-gráfica de intensidad (coordenadas del viewBox 0 0 100 36).
  private readonly chartTopY = 6;
  private readonly chartBottomY = 30;
  private readonly chartPadX = 4;

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

  // ---- Presentación de la tarjeta -------------------------------------------

  categoryIconFor(preset: TrainingPlanPreset): string {
    return CATEGORY_ICON[preset.category];
  }

  /** Color del bloque por posición (cíclico sobre la paleta). */
  blockColor(index: number): string {
    return BLOCK_COLORS[index % BLOCK_COLORS.length];
  }

  hiddenBlocks(preset: TrainingPlanPreset): TrainingBlockPreset[] {
    return preset.blocks.slice(this.maxVisibleBlocks);
  }

  /** Índice global del bloque (para mantener el color correcto en el popover). */
  blockIndex(preset: TrainingPlanPreset, block: TrainingBlockPreset): number {
    return preset.blocks.indexOf(block);
  }

  /** Duración en formato m:ss. */
  formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  /**
   * Construye la línea de intensidad: un tramo por bloque, centrado en su
   * vértice y unido en los puntos medios, de modo que cada bloque "posee" un
   * segmento del color de su punto en la lista.
   */
  intensitySegments(preset: TrainingPlanPreset): IntensitySegment[] {
    const blocks = preset.blocks;
    const n = blocks.length;
    const ys = blocks.map(
      (b) => this.chartBottomY - b.intensity * (this.chartBottomY - this.chartTopY)
    );

    // Un solo bloque: línea horizontal a su altura.
    if (n === 1) {
      return [{ points: `8,${ys[0].toFixed(1)} 92,${ys[0].toFixed(1)}`, color: this.blockColor(0) }];
    }

    const span = 100 - 2 * this.chartPadX;
    const xs = blocks.map((_, i) => this.chartPadX + (i / (n - 1)) * span);
    const mid = (a: number, b: number) => (a + b) / 2;

    return blocks.map((_, i) => {
      const startX = i === 0 ? xs[0] : mid(xs[i - 1], xs[i]);
      const startY = i === 0 ? ys[0] : mid(ys[i - 1], ys[i]);
      const endX = i === n - 1 ? xs[n - 1] : mid(xs[i], xs[i + 1]);
      const endY = i === n - 1 ? ys[n - 1] : mid(ys[i], ys[i + 1]);
      const points =
        `${startX.toFixed(1)},${startY.toFixed(1)} ` +
        `${xs[i].toFixed(1)},${ys[i].toFixed(1)} ` +
        `${endX.toFixed(1)},${endY.toFixed(1)}`;
      return { points, color: this.blockColor(i) };
    });
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
