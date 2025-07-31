import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { plansElosGuard } from './plans-elos.guard';

describe('plansElosGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => plansElosGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
