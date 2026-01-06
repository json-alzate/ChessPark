import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';


import { Plan, Block, PlanTypes } from '@cpark/models';
import { UidGeneratorService } from '@chesspark/common-utils';
import { PlanFacadeService } from '@cpark/state';

// services
import { FirestoreService } from '@services/firestore.service';
import { BlockService } from '@services/block.service';


@Injectable({
  providedIn: 'root'
})
export class PlanService {

  private firestoreService = inject(FirestoreService);
  private blockService = inject(BlockService);
  private uidGenerator = inject(UidGeneratorService);
  private planFacade = inject(PlanFacadeService);
  
  constructor(
  ) { }



 

  /**
   *
   * @param blocks
   * @param time in seconds (-1 for infinite)
   * */
  newPlan(blocks: Block[], planType: PlanTypes): Promise<Plan> {
    this.planFacade.loadPlan();
    return new Promise((resolve, reject) => {
      try {
        const plan: Plan = {
          uid: this.uidGenerator.generateSimpleUid(),
          blocks,
          planType,
          createdAt: new Date().getTime(),
        };
        this.planFacade.setPlan(plan);
        resolve(plan);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'No se pudo crear el plan';
        this.planFacade.setPlanError(message);
        reject(error);
      }
    });
  }

  /**
   * Save the plan
   */
  savePlan(plan: Plan) {
    return this.firestoreService.savePlan(plan);
  }
}
