import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';


import { Plan, Block, PlanTypes } from '@cpark/models';
import { UidGeneratorService } from '@chesspark/common-utils';

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
  
  constructor(
  ) { }



 

  /**
   *
   * @param blocks
   * @param time in seconds (-1 for infinite)
   * */
  newPlan(blocks: Block[], planType: PlanTypes): Promise<Plan> {
    return new Promise((resolve, reject) => {
      const plan: Plan = {
        uid: this.uidGenerator.generateSimpleUid(),
        blocks,
        planType,
        createdAt: new Date().getTime(),
      };
      resolve(plan);
    });
  }

  /**
   * Save the plan
   */
  savePlan(plan: Plan) {
    return this.firestoreService.savePlan(plan);
  }
}
