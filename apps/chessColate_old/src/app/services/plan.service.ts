import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';


import { Plan, Block, PlanTypes } from '@models/plan.model';

import { createUid } from '@utils/create-uid';

// State
import { AppState, getPlanState } from '@redux/states/app.state';

// Store
import { Store } from '@ngrx/store';

// Actions
import { setPlan, requestSavePlan, requestGetPlans } from '@redux/actions/plans.actions';

// Selectors
import { getPlan } from '@redux/selectors/plan.selectors';
import { getPlansHistoryOrderByDate } from '@redux/selectors/plans-history.selectors';

// services
import { FirestoreService } from '@services/firestore.service';
import { BlockService } from '@services/block.service';
import { PlansElosService } from '@services/plans-elos.service';


@Injectable({
  providedIn: 'root'
})
export class PlanService {

  constructor(
    private store: Store<Store>,
    private firestoreService: FirestoreService,
    private blockService: BlockService,
    private plansElosService: PlansElosService
  ) { }


  /**
   * Actions
   */

  setPlanAction(plan: Plan) {
    this.store.dispatch(setPlan({ plan }));
  }

  requestSavePlanAction(plan: Plan) {
    // clear puzzles in blocks
    plan = {
      ...plan,
      blocks: plan.blocks.map((block: Block) => ({
        ...block,
        puzzles: []
      }))
    };
    this.store.dispatch(requestSavePlan({ plan }));
  }


  requestGetPlansAction(uidUser: string) {
    this.store.dispatch(requestGetPlans({ uidUser }));
  }

  getPlans(uidUser: string): Promise<Plan[]> {
    return this.firestoreService.getPlans(uidUser);
  }

  /** END ACTIONS */

  /** STATE OBSERVABLES */

  getPlansHistoryState(): Observable<Plan[]> {
    return this.store.select(getPlansHistoryOrderByDate);
  }

  async makeCustomPlanForPlay(planRecibe: Plan, eloToStart = 1500): Promise<Plan> {

    const plan = { ...planRecibe };

    let uid = plan.uid;
    if (plan.planType === 'custom') {
      uid = plan.uidCustomPlan;
    }

    const planElos = await this.plansElosService.getOnePlanElo(uid);

    // se recorre cada bloque para generar los puzzles
    const blockUpdatedToAdd = [];
    for (const block of plan.blocks) {
      let theme = block.theme;
      if (block.theme === 'weakness') {
        if (planElos?.themes) {
          theme = this.plansElosService.getWeakness(planElos.themes);
        } else {
          // TODO: falta preguntar por las aperturas
          theme = this.blockService.getRandomTheme();
        }
      } else if (block.theme === 'all') {
        theme = this.blockService.getRandomTheme();
      }
      const blockObjectToAdd = {
        ...block,
        puzzles: await this.blockService.getPuzzlesForBlock({ ...block, elo: planElos?.total || eloToStart, theme }),
        puzzlesPlayed: [],
        theme
      };

      blockUpdatedToAdd.push(blockObjectToAdd);
    }

    if (plan.planType === 'custom') {
      return { ...plan, uid: createUid(), uidCustomPlan: plan.uid, blocks: blockUpdatedToAdd, createdAt: new Date().getTime() };
    }

    return { ...plan, blocks: blockUpdatedToAdd, createdAt: new Date().getTime() };

  }


  /**
   *
   * @param blocks
   * @param time in seconds (-1 for infinite)
   * */
  newPlan(blocks: Block[], planType: PlanTypes): Promise<Plan> {
    return new Promise((resolve, reject) => {
      const plan: Plan = {
        uid: createUid(),
        blocks,
        planType,
        createdAt: new Date().getTime(),
      };
      this.setPlanAction(plan);
      resolve(plan);
    });
  }

  /**
   * Get the current plan
   * */
  getPlan(): Promise<Plan> {
    return new Promise((resolve, reject) => {
      this.store.select(getPlan).subscribe((plan: Plan) => {
        resolve(plan);
      });
    });
  }

  /**
   * Save the plan
   */
  savePlan(plan: Plan) {
    return this.firestoreService.savePlan(plan);
  }
}
