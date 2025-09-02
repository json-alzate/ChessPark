import { Puzzle } from './puzzle.model';
import { UserPuzzle } from './user-puzzles.model';

export type PlanTypes = 'warmup' | 'plan5' | 'plan10' | 'plan20' | 'plan30' | 'backToCalm' | 'custom';



export interface Block {
    title?: string;
    description?: string;
    time: number; // in seconds (-1 for infinite)
    puzzlesCount: number; // 0 for infinite (until time is over)
    theme: string;
    openingFamily?: string;
    elo: number;
    color: 'white' | 'black' | 'random';
    puzzleTimes?: {
        warningOn: number; // in seconds, -1 for off
        dangerOn: number; // in seconds, -1 for off
        total: number; // in seconds, -1 for off
    };
    puzzles?: Puzzle[];
    puzzlesPlayed: UserPuzzle[];
    showPuzzleSolution?: boolean;
    nextPuzzleImmediately?: boolean;
    goshPuzzle?: boolean;
    goshPuzzleTime?: number;
};

export interface Plan {
    uid: string;
    title?: string;
    uidUser?: string;
    eloTotal?: number;
    blocks: Block[];
    createdAt: number;
    planType: PlanTypes;
    uidCustomPlan?: string; // en caso de que el plan sea creado por el usuario , se utiliza para obtener los elos
};
