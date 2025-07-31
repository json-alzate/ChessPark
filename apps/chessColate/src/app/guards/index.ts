import { CoordinatesPuzzlesGuard } from './coordinates-puzzles.guard';
import { PuzzlesGuard } from './puzzles.guard';
import { UserPuzzlesGuard } from './user-puzzles.guard';
import { PlansGuard } from './plans.guard';
import { PlansElosGuard } from './plans-elos.guard';
import { CustomPlansGuard } from './custom-plans.guard';

export const guards: any[] = [
    CoordinatesPuzzlesGuard,
    PuzzlesGuard,
    UserPuzzlesGuard,
    PlansGuard,
    PlansElosGuard,
    CustomPlansGuard
];
