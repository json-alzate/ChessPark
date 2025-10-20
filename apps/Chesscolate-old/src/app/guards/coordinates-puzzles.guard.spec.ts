import { TestBed } from '@angular/core/testing';

import { CoordinatesPuzzlesGuard } from './coordinates-puzzles.guard';

describe('CoordinatesPuzzlesGuard', () => {
  let guard: CoordinatesPuzzlesGuard;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    guard = TestBed.inject(CoordinatesPuzzlesGuard);
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });
});
