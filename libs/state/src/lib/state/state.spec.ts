import { ComponentFixture, TestBed } from '@angular/core/testing';
import { State } from './state';

describe('State', () => {
  let component: State;
  let fixture: ComponentFixture<State>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [State],
    }).compileComponents();

    fixture = TestBed.createComponent(State);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
