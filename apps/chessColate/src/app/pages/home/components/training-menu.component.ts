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

import { IonRippleEffect, LoadingController } from '@ionic/angular/standalone';

// services
import { BlockService } from '@services/block.service';
import { PlanService } from '@services/plan.service';
import { ProfileService } from '@services/profile.service';

import { addIcons } from 'ionicons';
import { timerOutline } from 'ionicons/icons';
import { Block, Plan, PlanTypes } from '@cpark/models';
import { Router } from '@angular/router';

@Component({
  selector: 'app-training-menu',
  imports: [CommonModule, IonRippleEffect],
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
  private destroy$ = new Subject<void>();

  constructor(private loadingController: LoadingController) {
    addIcons({ timerOutline });
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

  async createPlan(planNumber: number) {
    const planType = `plan${planNumber}` as PlanTypes;

    const loader = await this.loadingController.create({
      message: 'Creando plan...',
    });
    await loader.present();

    try {
      const blocks: Block[] = await this.blockService.generateBlocksForPlan(planType);

      // Cargar puzzles de todos los bloques en paralelo
      const total = blocks.length;
      let loaded = 0;

      const puzzlePromises = blocks.map(async (block, index) => {
        const puzzles = await this.blockService.getPuzzlesForBlock(block);
        block.puzzles = puzzles;
        loaded++;

        // Actualizar el mensaje de progreso
        if (loader) {
          loader.message = `Cargando puzzles... ${loaded}/${total}`;
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
