
import { AuthEffects } from './auth.effects';
import { CoordinatesEffects } from './coordinates.effects';
import { UserPuzzlesEffects } from './user-puzzles.effects';
import { PlanEffects } from './plan.effects';
import { PlaneElosEffects } from './plan-elos.effects';
import { CustomPlansEffects } from './custom-plans.effects';

export const EFFECTS: any[] = [
    AuthEffects,
    CoordinatesEffects,
    UserPuzzlesEffects,
    PlanEffects,
    PlaneElosEffects,
    CustomPlansEffects
];
