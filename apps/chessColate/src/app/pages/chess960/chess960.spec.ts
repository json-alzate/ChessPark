import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Chess960 } from './chess960';

describe('Chess960', () => {
  let component: Chess960;
  let fixture: ComponentFixture<Chess960>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Chess960],
    }).compileComponents();

    fixture = TestBed.createComponent(Chess960);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
