import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlanPlayedComponent } from '@app/pages/puzzles/containers/plan-played/plan-played.component';

describe('PlanPlayedComponent', () => {
  let component: PlanPlayedComponent;
  let fixture: ComponentFixture<PlanPlayedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlanPlayedComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlanPlayedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

