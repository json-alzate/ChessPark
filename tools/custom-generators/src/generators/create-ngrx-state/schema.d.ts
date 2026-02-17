export interface CreateNgrxStateGeneratorSchema {
  name: string;
  entityType: 'list' | 'single';
  description?: string;
  hasEffects?: boolean;
  hasFacade?: boolean;
  hasTests?: boolean;
  createModel?: boolean;
  registerInApp?: boolean;
}
