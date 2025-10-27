import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
// Ionic
import { IonContent } from '@ionic/angular/standalone';

import { Block, PlanTypes } from '@cpark/models';

// Services
import { BlockService } from '@services/block.service';

// Components
import { NavbarComponent } from '@shared/components/navbar/navbar.component';
import { TrainingMenuComponent } from './components/training-menu.component';



@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    IonContent,
    CommonModule,
    NavbarComponent,
    TrainingMenuComponent],
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {

  constructor(private blockService: BlockService) {
    // setTimeout(() => {
    //   this.createPlan('plan5');
    // }, 2000);
  }


  async createPlan(planType: PlanTypes) {
    const blocks: Block[] = await this.blockService.generateBlocksForPlan(planType);

    // se recorre cada bloque para generar los puzzles
    for (const block of blocks) {
      block.puzzles = await this.blockService.getPuzzlesForBlock(block);
    }

    console.log(blocks);
    

  }

  goToCustomPlanCreate() {
    console.log('Navigating to custom plan creation');
    // Aquí iría la lógica para navegar a la página de creación de planes personalizados
  }
}
