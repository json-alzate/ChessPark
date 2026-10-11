import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TimerComponent } from '@app/features/coordinates/components/timer/timer.component';
import { textoDe, translocoTesting } from '@tests/support/analisis-juegos';

describe('TimerComponent', () => {
  let fixture: ComponentFixture<TimerComponent>;
  let component: TimerComponent;

  const barra = (): HTMLElement | null => fixture.nativeElement.querySelector('progress');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimerComponent, translocoTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(TimerComponent);
    component = fixture.componentInstance;
  });

  it('muestra los segundos restantes redondeados y el avance de la barra', () => {
    component.time = 42.6;
    component.progressValue = 0.5;
    fixture.detectChanges();
    expect(textoDe(fixture.nativeElement.querySelector('.tabular-nums'))).toBe('43');
    expect(barra()?.getAttribute('value')).toBe('50');
  });

  it.each([
    ['success', 'progress-success'],
    ['warning', 'progress-warning'],
    ['danger', 'progress-error'],
  ] as const)('colorea la barra "%s" con %s', (color, clase) => {
    component.timeColor = color;
    fixture.detectChanges();
    expect(barra()?.classList).toContain(clase);
  });

  it('en modo infinito oculta la barra y muestra la insignia', () => {
    component.infiniteMode = true;
    fixture.detectChanges();
    expect(component.displayTime).toBe('∞');
    expect(component.displayProgress).toBe(100);
    expect(barra()).toBeNull();
    expect(textoDe(fixture.nativeElement)).toContain('COORDINATES.game.infinite');
  });

  it('un tiempo Infinity también cuenta como modo infinito', () => {
    component.time = Infinity;
    fixture.detectChanges();
    expect(component.isInfiniteMode).toBe(true);
    expect(barra()).toBeNull();
  });
});
