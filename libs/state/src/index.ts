// states and reducers
export * from './lib/app.state';
export * from './lib/app.reducers';

// features
export * from './lib/auth';
export * from './lib/plan';
export * from './lib/plansElos';
export * from './lib/customPlans';

// effects
import { AuthEffects } from './lib/auth';
import { PlansElosEffects } from './lib/plansElos';
import { CustomPlansEffects } from './lib/customPlans';

export const EFFECTS = [AuthEffects, PlansElosEffects, CustomPlansEffects];
