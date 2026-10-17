import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WoodpeckerCycleResultComponent } from '@features/woodpecker/components/woodpecker-cycle-result/woodpecker-cycle-result.component';
import { WoodpeckerCycleComparison } from '@features/woodpecker/models/woodpecker.model';
import { summarizeCycle } from '@features/woodpecker/utils/woodpecker-stats.util';
import { resultado, vuelta } from '@tests/support/pajaro-carpintero';
import { translocoParaPruebas } from '@tests/support/racha-ajustes-recordatorios';

describe('WoodpeckerCycleResultComponent', () => {
  let fixture: ComponentFixture<WoodpeckerCycleResultComponent>;

  const actual = summarizeCycle(
    vuelta(
      2,
      ['a', 'b', 'c', 'd'],
      [
        resultado('a', true, 4_000),
        resultado('b', true, 4_000),
        resultado('c', true, 4_000),
        resultado('d', false, 8_000, true),
      ],
      { finishedAt: 5 }
    )
  );

  function pintar(comparison: WoodpeckerCycleComparison | null) {
    fixture.componentRef.setInput('current', actual);
    fixture.componentRef.setInput('comparison', comparison);
    fixture.detectChanges();
  }

  const texto = (id: string) =>
    (fixture.nativeElement.querySelector(`[data-testid=${id}]`) as HTMLElement | null)?.textContent ?? null;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WoodpeckerCycleResultComponent, translocoParaPruebas()],
    }).compileComponents();
    fixture = TestBed.createComponent(WoodpeckerCycleResultComponent);
  });

  it('enseña el acierto, lo resuelto y el tiempo total', () => {
    pintar(null);

    expect(texto('result-accuracy')).toContain('75 %');
    expect(texto('result-accuracy')).toContain('3 / 4');
    expect(texto('result-time')).toContain('0:20');
  });

  it('en la primera vuelta no hay cambios que enseñar', () => {
    pintar(null);

    expect(texto('result-accuracy-delta')).toBeNull();
    expect(texto('result-time-delta')).toBeNull();
  });

  it('mejorar el acierto y el tiempo se dice en positivo', () => {
    pintar({ accuracyDelta: 15, timeDeltaPercent: -30 });

    expect(texto('result-accuracy-delta')).toContain('WOODPECKER.progress.moreAccurate');
    expect(texto('result-time-delta')).toContain('WOODPECKER.progress.faster');
  });

  it('empeorar se dice con los textos contrarios', () => {
    pintar({ accuracyDelta: -10, timeDeltaPercent: 25 });

    expect(texto('result-accuracy-delta')).toContain('WOODPECKER.progress.lessAccurate');
    expect(texto('result-time-delta')).toContain('WOODPECKER.progress.slower');
  });

  it('sin base de tiempo no se inventa un porcentaje', () => {
    pintar({ accuracyDelta: 5, timeDeltaPercent: null });

    expect(texto('result-accuracy-delta')).not.toBeNull();
    expect(texto('result-time-delta')).toBeNull();
  });

  it('avisa de los ejercicios que se quedaron sin tiempo', () => {
    pintar(null);
    expect(texto('result-timeouts')).toContain('WOODPECKER.progress.failedByTime');
  });
});
