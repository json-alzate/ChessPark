import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { customPlansGuard } from './custom-plans.guard';

describe('customPlansGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => customPlansGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
