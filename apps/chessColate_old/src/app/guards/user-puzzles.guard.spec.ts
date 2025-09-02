import { TestBed } from '@angular/core/testing';

import { UserPuzzlesGuard } from './user-puzzles.guard';

describe('UserPuzzlesGuard', () => {
  let guard: UserPuzzlesGuard;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    guard = TestBed.inject(UserPuzzlesGuard);
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });
});
