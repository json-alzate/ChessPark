import { TestBed } from '@angular/core/testing';

import { PuzzlesGuard } from './puzzles.guard';

describe('PuzzlesGuard', () => {
  let guard: PuzzlesGuard;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    guard = TestBed.inject(PuzzlesGuard);
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });
});
