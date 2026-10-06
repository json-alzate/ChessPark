import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectorRef,
  ElementRef,
  ViewChild,
  inject,
  AfterViewInit,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';

import {
  IonIcon,
  IonRippleEffect,
  LoadingController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { eyeOffOutline, eyeOutline, playOutline, timeOutline } from 'ionicons/icons';

// services
import { BlockService } from '@services/training/block.service';
import { PlanService } from '@services/plans/plan.service';
import { ProfileService } from '@services/account/profile.service';

import { Block, Plan, PlanTypes } from '@cpark/models';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  planImage,
  TRAINING_PLAN_PRESETS,
  TrainingPlanPreset,
} from './training-plans.config';

interface SwiperEl extends HTMLElement {
  swiper?: { slideTo: (index: number, speed?: number, runCallbacks?: boolean) => void };
}

@Component({
  selector: 'app-training-menu',
  imports: [CommonModule, IonIcon, IonRippleEffect, TranslocoPipe],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './training-menu.component.html',
  styleUrl: './training-menu.component.scss',
})
export class TrainingMenuComponent implements OnInit, AfterViewInit, OnDestroy {
  private blockService = inject(BlockService);
  private planService = inject(PlanService);
  private profileService = inject(ProfileService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private translocoService = inject(TranslocoService);
  private destroy$ = new Subject<void>();

  readonly presets: TrainingPlanPreset[] = TRAINING_PLAN_PRESETS;

  /** Rutina recomendada por defecto: 10 min, el "daily driver" completo sin agotar. */
  readonly recommendedPlan = 10;
  readonly recommendedIndex = this.presets.findIndex(
    (p) => p.plan === this.recommendedPlan
  );

  /** Índice de la tarjeta activa en el slider mobile (arranca en la recomendada). */
  activeSlide = this.recommendedIndex;

  /** Plan cuya lista de bloques ("Qué entrenas") está revelada; null si ninguna. */
  revealedPlan: number | null = null;

  @ViewChild('swiperRef') swiperRef?: ElementRef<SwiperEl>;

  constructor(private loadingController: LoadingController) {
    addIcons({ eyeOutline, eyeOffOutline, playOutline, timeOutline });
  }

  ngOnInit(): void {
    this.profileService.profile$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.cdr.markForCheck());
  }

  ngAfterViewInit(): void {
    // El binding de `initial-slide` llega tarde (Swiper ya inicializó en el
    // slide 0), así que posicionamos la tarjeta recomendada por código.
    const goToRecommended = () =>
      this.swiperRef?.nativeElement?.swiper?.slideTo(this.recommendedIndex, 0);
    if (this.swiperRef?.nativeElement?.swiper) {
      goToRecommended();
    } else {
      setTimeout(goToRecommended);
    }
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

  imageFor(preset: TrainingPlanPreset): string {
    return planImage(`plan${preset.plan}` as PlanTypes);
  }

  // ---- Qué entrenas (revelar bloques sin iniciar la rutina) -----------------

  /** Muestra/oculta la lista de bloques sin iniciar la rutina. */
  toggleBlocks(plan: number, event: Event): void {
    event.stopPropagation();
    this.revealedPlan = this.revealedPlan === plan ? null : plan;
    this.cdr.markForCheck();
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
