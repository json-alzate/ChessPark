import { TestBed } from '@angular/core/testing';

import { CoordinatesPuzzlesService } from './coordinates-puzzles.service';

describe('CoordinatesPuzzlesService', () => {
  let service: CoordinatesPuzzlesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CoordinatesPuzzlesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
