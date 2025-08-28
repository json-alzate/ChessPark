import { TestBed } from '@angular/core/testing';

import { SquaresService } from './squares.service';

describe('SquaresService', () => {
  let service: SquaresService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SquaresService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
