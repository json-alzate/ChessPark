import { inject, Injectable } from '@angular/core';
import { Plan, Block, PlanTypes } from '@cpark/models';
import { UidGeneratorService } from '@chesspark/common-utils';
import { PlanFacadeService } from '@cpark/state';

// services
import { FirestoreService } from '@services/firestore.service';
import { BlockService } from '@services/block.service';
import { ProfileService } from '@services/profile.service';
import { PlansElosService } from '@services/plans-elos.service';

@Injectable({
  providedIn: 'root'
})
export class PlanService {

  private firestoreService = inject(FirestoreService);
  private blockService = inject(BlockService);
  private profileService = inject(ProfileService);
  private plansElosService = inject(PlansElosService);
  private uidGenerator = inject(UidGeneratorService);
  private planFacade = inject(PlanFacadeService);

  /**
   * Prepara un plan personalizado para jugar: resuelve temas (all/weakness), carga puzzles
   * por bloque y devuelve un plan con uid nuevo listo para setPlan y navegar a training.
   * @param onProgress callback opcional para reportar progreso (loaded, total)
   */
  async makeCustomPlanForPlay(
    plan: Plan,
    eloToStart = 1500,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<Plan> {
    const uid = plan.uidCustomPlan ?? plan.uid;
    const planElos = await this.plansElosService.getOnePlanElo(uid);
    const eloBase = planElos?.total ?? eloToStart;

    const blockUpdatedToAdd: Block[] = [];
    const total = plan.blocks.length;
    for (let i = 0; i < plan.blocks.length; i++) {
      const b = plan.blocks[i];
      let theme = b.theme;
      if (b.theme === 'weakness') {
        const weakness = planElos?.themes ? this.plansElosService.getWeakness(planElos.themes) : null;
        theme = weakness ?? this.blockService.getRandomTheme();
      } else if (b.theme === 'all') {
        theme = this.blockService.getRandomTheme();
      }
      const blockWithTheme = { ...b, theme, elo: eloBase };
      const puzzles = await this.blockService.getPuzzlesForBlock(blockWithTheme);
      blockUpdatedToAdd.push({
        ...blockWithTheme,
        puzzles,
        puzzlesPlayed: [],
      });
      onProgress?.(i + 1, total);
    }

    return {
      ...plan,
      uid: this.uidGenerator.generateSimpleUid(),
      uidCustomPlan: plan.uid,
      planType: 'custom',
      blocks: blockUpdatedToAdd,
      createdAt: Date.now(),
    };
  }

  /**
   * @param blocks
   * @param time in seconds (-1 for infinite)
   */
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
