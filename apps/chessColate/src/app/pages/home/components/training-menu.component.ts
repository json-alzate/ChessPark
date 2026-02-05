import { Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IonRippleEffect, LoadingController } from '@ionic/angular/standalone';

// services
import { BlockService } from '@services/block.service';
import { PlanService } from '@services/plan.service';

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
export class TrainingMenuComponent {
  private blockService = inject(BlockService);
  private planService = inject(PlanService);
  private router = inject(Router);
  constructor(private loadingController: LoadingController) {
    addIcons({ timerOutline });
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
