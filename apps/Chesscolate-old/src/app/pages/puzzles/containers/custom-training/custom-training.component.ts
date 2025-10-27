import { Component, OnInit } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';

import { ModalController, NavController } from '@ionic/angular';

import { createUid } from '@utils/create-uid';

import { Plan, Block, PlanTypes } from '@models/plan.model';

import { ProfileService } from '@services/profile.service';
import { PlanService } from '@services/plan.service';
import { CustomPlansService } from '@services/custom-plans.service';
import { BlockService } from '@services/block.service';

import { BlockSettingsComponent } from '@pages/puzzles/components/block-settings/block-settings.component';

@Component({
  selector: 'app-custom-training',
  templateUrl: './custom-training.component.html',
  styleUrls: ['./custom-training.component.scss'],
})
export class CustomTrainingComponent implements OnInit {


  blocks: Block[] = [];
  namePlanFormControl = new FormControl('', [Validators.required, Validators.maxLength(30)]);


  constructor(
    private modalController: ModalController,
    private profileService: ProfileService,
    private planService: PlanService,
    private customPlansService: CustomPlansService,
    private blockService: BlockService,
    private navController: NavController
  ) { }

  ngOnInit() { }

  async openBlockSettingsModal() {
    const modal = await this.modalController.create({
      component: BlockSettingsComponent,
      initialBreakpoint: 0.8,
      breakpoints: [0, 0.25, 0.5, 0.75],

    });
    modal.present();

    const { data } = await modal.onDidDismiss();
    if (data) {
      this.blocks.push(data);
      console.log(data);
    }
  }

  doReorder(event: any) {
    // Reordenar los elementos de la lista
    const itemMove = this.blocks.splice(event.detail.from, 1)[0];
    this.blocks.splice(event.detail.to, 0, itemMove);
    // Completar el evento de reorder
    event.detail.complete();
  }

  async saveAndPlay() {
    // Se suma el tiempo de los bloques, y se calcula el tiempo total para obtener el elo total,
    // obteniéndolo de un plan predeterminado (si se tiene), sino es 1500

    console.log(this.namePlanFormControl.value);

    if (!this.namePlanFormControl.value || !this.namePlanFormControl.valid) {
      this.namePlanFormControl.markAsTouched();
      this.namePlanFormControl.markAsDirty();
      return;
    }


    // Se calcula el tiempo total de los bloques
    const totalBlockTime = this.blocks.reduce((sum, block) => sum + block.time, 0);
    const profile = this.profileService.getProfile;
    let eloToStart = 1500;
    let planEloChosen: PlanTypes;// en caso de que se tenga que elegir el elo de una debilidad en un bloque

    if (profile) {
      if (totalBlockTime <= 3000 && profile.elos?.plan5Total) {
        eloToStart = profile.elos?.plan5Total;
        planEloChosen = 'plan5';
      } else if ((totalBlockTime > 3000 && totalBlockTime <= 6000) && profile.elos?.plan10Total) {
        eloToStart = profile.elos?.plan10Total;
        planEloChosen = 'plan10';
      } else if ((totalBlockTime > 6000 && totalBlockTime <= 12000) && profile.elos?.plan20Total) {
        eloToStart = profile.elos?.plan20Total;
        planEloChosen = 'plan20';
      } else if ((totalBlockTime > 12000) && profile.elos?.plan30Total) {
        eloToStart = profile.elos?.plan30Total;
        planEloChosen = 'plan30';
      }
    }
    const uid = createUid();

    const newPlan: Plan = {
      uid,
      uidCustomPlan: uid,
      title: this.namePlanFormControl.value,
      uidUser: this.profileService.getProfile.uid,
      createdAt: new Date().getTime(),
      planType: 'custom',
      blocks: [...this.blocks]
    };

    this.customPlansService.requestAddOneCustomPlan(newPlan);

    const newPlanToPlay = await this.planService.makeCustomPlanForPlay(newPlan, eloToStart);
    this.planService.setPlanAction(newPlanToPlay);
    this.navController.navigateForward('/puzzles/training');
  }

  getThemeRandomOrWeakness(block: Block, planEloChosen: PlanTypes) {
    if (block.theme === 'all') {
      // get random theme
      return this.blockService.getRandomTheme();
    } else if (block.theme === 'weakness') {
      // get weakness in plan
      return this.blockService.getWeaknessInPlan(this.profileService.getElosThemesByPlanType(planEloChosen));
    } else {
      return block.theme;
    }
  }

}
