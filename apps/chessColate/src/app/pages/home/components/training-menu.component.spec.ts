import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TrainingMenuComponent } from './training-menu.component';

describe('TrainingMenuComponent', () => {
  let component: TrainingMenuComponent;
  let fixture: ComponentFixture<TrainingMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrainingMenuComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TrainingMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
