import { Block } from './block.model';


export type PlanTypes = 'warmup' | 'plan1' | 'plan3' | 'plan5' | 'plan10' | 'plan20' | 'plan30' | 'backToCalm' | 'custom' | 'infinity';

export interface Plan {
    uid: string;
    title?: string;
    uidUser?: string;
    eloTotal?: number;
    blocks: Block[];
    createdAt: number;
    planType: PlanTypes;
    isFinished?: boolean;
    uidCustomPlan?: string; // en caso de que el plan sea creado por el usuario , se utiliza para obtener los elos
    isPublic?: boolean; // si el plan es visible para otros usuarios
    initialMaxElo?: number; // ELO máximo que tenía el plan antes de empezar a jugar (para comparar al final)
}