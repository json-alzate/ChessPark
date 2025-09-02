import { TestBed } from '@angular/core/testing';

import { CustomPlansService } from './custom-plans.service';

describe('CustomPlansService', () => {
  let service: CustomPlansService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CustomPlansService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
