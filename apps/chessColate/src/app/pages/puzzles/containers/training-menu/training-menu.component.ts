import { Component, OnInit } from '@angular/core';
import { NavController, LoadingController, ModalController } from '@ionic/angular';
import { Observable } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { differenceInHours } from 'date-fns';

import { Meta } from '@angular/platform-browser';

import { Profile } from '@models/profile.model';
import { Plan, Block, PlanTypes } from '@models/plan.model';

import { PlanService } from '@services/plan.service';
import { BlockService } from '@services/block.service';
import { ProfileService } from '@services/profile.service';
import { CustomPlansService } from '@services/custom-plans.service';


import { LoginComponent } from '@shared/components/login/login.component';
import { PuzzleSolutionComponent } from '@pages/puzzles/components/puzzle-solution/puzzle-solution.component';

@Component({
  selector: 'app-training-menu',
  templateUrl: './training-menu.component.html',
  styleUrls: ['./training-menu.component.scss'],
})
export class TrainingMenuComponent implements OnInit {

  loader: any;
  profile: Profile;
  generalEloPlan5: string | number = '1500?';
  generalEloPlan10: string | number = '1500?';
  generalEloPlan20: string | number = '1500?';
  generalEloPlan30: string | number = '1500?';

  planBlood: 'warmup' | 'backToCalm' | 'none' = 'none';

  loadActivityChart = false;

  plansHistory$: Observable<Plan[]>;
  customPlans$: Observable<Plan[]>;

  constructor(
    private navController: NavController,
    private planService: PlanService,
    private blockService: BlockService,
    private loadingController: LoadingController,
    private profileService: ProfileService,
    private meta: Meta,
    private modalController: ModalController,
    private translateService: TranslateService,
    private customPlansService: CustomPlansService
  ) {
    this.profileService.subscribeToProfile().subscribe((profile) => {
      this.profile = profile;
      if (profile) {
        this.generalEloPlan5 = profile.elos?.plan5Total || '1500?';
        this.generalEloPlan10 = profile.elos?.plan10Total || '1500?';
        this.generalEloPlan20 = profile.elos?.plan20Total || '1500?';
        this.generalEloPlan30 = profile.elos?.plan30Total || '1500?';
      } else {
        this.generalEloPlan5 = '1500?';
        this.generalEloPlan10 = '1500?';
        this.generalEloPlan20 = '1500?';
        this.generalEloPlan30 = '1500?';
      }
    });
  }

  ngOnInit() {

    this.plansHistory$ = this.planService.getPlansHistoryState();
    this.customPlans$ = this.customPlansService.getCustomPlansState();

    // Si lleva mas de 2 horas desde el ultimo plan, se activa el warmup
    // si el ultimo plan es hace menos de 2 horas y es diferente a backToCalm, se activa backToCalm
    // sino se activa none
    if (this.plansHistory$) {
      this.plansHistory$.subscribe((plans) => {
        if (plans.length > 0) {  // Si hay al menos un plan
          const lastPlan = plans[0];  // Último plan
          const diff = differenceInHours(new Date(), new Date(lastPlan.createdAt));
          // Si lleva más de 2 horas desde el último plan
          if (diff > 2) {
            this.planBlood = 'warmup';
          } else if (lastPlan.planType !== 'backToCalm') {
            this.planBlood = 'backToCalm';
          } else {
            this.planBlood = 'none';
          }
        } else {
          this.planBlood = 'warmup';
        }
      });
    }



    this.meta.addTags([
      { name: 'title', content: 'ChessColate' },
      { name: 'description', content: 'Planes de entrenamiento táctico de ajedrez listos para jugar.' },
      { name: 'keywords', content: 'ajedrez, táctica, entrenamiento, chess, tactic, training chess' },
      { name: 'robots', content: 'index, follow' },
      { property: 'og:title', content: 'ChessColate' },
      { property: 'og:description', content: 'Planes de entrenamiento táctico de ajedrez listos para jugar.' },
      { property: 'og:image', content: 'https://chesscolate.com/assets/tags/chesscolate.jpg' },
      { property: 'og:url', content: 'https://chesscolate.com/puzzles/training-menu' }
    ]);
  }

  ionViewDidEnter() {

    this.loadActivityChart = true;
  }

  async createPlan(planType: PlanTypes) {
    this.showLoading();
    const blocks: Block[] = await this.blockService.generateBlocksForPlan(planType);

    // se recorre cada bloque para generar los puzzles
    for (const block of blocks) {
      block.puzzles = await this.blockService.getPuzzlesForBlock(block);
    }

    const newPlan: Plan = await this.planService.newPlan(blocks, planType);
    this.closeLoading();
    this.goTo('/puzzles/training');

  }


  async showLoading() {
    this.loader = await this.loadingController.create({
      message: this.translateService.instant('loadingPuzzles'),
    });

    this.loader.present();
  }

  closeLoading() {
    if (this.loader) {
      this.loader.dismiss();
    }
  }



  goToCustomPlanCreate() {
    if (this.profile) {
      this.goTo('/puzzles/custom-training');
    } else {
      this.presentModalLogin();
    }
  }

  async onChoosePlan(plan: Plan) {
    const planReadyToPlay = await this.planService.makeCustomPlanForPlay(plan);
    this.planService.setPlanAction(planReadyToPlay);
    this.navController.navigateForward('/puzzles/training');
  }

  async presentModalLogin() {
    const modal = await this.modalController.create({
      component: LoginComponent,
      componentProps: { showAs: 'modal' },
    });
    await modal.present();
  }


  goTo(path: string) {
    this.navController.navigateForward(path);
  }

}
