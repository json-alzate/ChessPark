import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Widgets } from './widgets';

describe('Widgets', () => {
  let component: Widgets;
  let fixture: ComponentFixture<Widgets>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Widgets],
    }).compileComponents();

    fixture = TestBed.createComponent(Widgets);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
