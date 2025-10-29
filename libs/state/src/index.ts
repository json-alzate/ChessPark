

// states and reducers
export * from './lib/app.state';
export * from './lib/app.reducers';

// features
export * from './lib/auth';
export * from './lib/plan';

// effects
import { AuthEffects } from './lib/auth';

export const EFFECTS = [
    AuthEffects
];