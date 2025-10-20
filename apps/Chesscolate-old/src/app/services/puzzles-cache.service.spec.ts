import { TestBed } from '@angular/core/testing';

import { PuzzlesCacheService } from './puzzles-cache.service';

describe('PuzzlesCacheService', () => {
  let service: PuzzlesCacheService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PuzzlesCacheService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
