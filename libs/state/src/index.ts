// states and reducers
export * from './lib/app.state';
export * from './lib/app.reducers';

// features
export * from './lib/auth';
export * from './lib/plan';
export * from './lib/plansElos';

// effects
import { AuthEffects } from './lib/auth';
import { PlansElosEffects } from './lib/plansElos';

export const EFFECTS = [AuthEffects, PlansElosEffects];
