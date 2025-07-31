import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { PuzzlesPlayedPreviewComponent } from './puzzles-played-preview.component';

describe('PuzzlesPlayedPreviewComponent', () => {
  let component: PuzzlesPlayedPreviewComponent;
  let fixture: ComponentFixture<PuzzlesPlayedPreviewComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ PuzzlesPlayedPreviewComponent ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(PuzzlesPlayedPreviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
