import { TestBed } from '@angular/core/testing';

import { UserPuzzlesService } from './user-puzzles.service';

describe('UserPuzzlesService', () => {
  let service: UserPuzzlesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UserPuzzlesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
