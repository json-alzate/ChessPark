import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Chess960Board } from './chess960-board';

describe('Chess960Board', () => {
  let component: Chess960Board;
  let fixture: ComponentFixture<Chess960Board>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Chess960Board],
    }).compileComponents();

    fixture = TestBed.createComponent(Chess960Board);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
