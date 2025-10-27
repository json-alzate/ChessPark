import { TestBed } from '@angular/core/testing';

import { PuzzlesService } from './puzzles.service';

describe('PuzzlesService', () => {
  let service: PuzzlesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PuzzlesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
