import { TestBed } from '@angular/core/testing';

import { PlansElosService } from './plans-elos.service';

describe('PlansElosService', () => {
  let service: PlansElosService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PlansElosService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
