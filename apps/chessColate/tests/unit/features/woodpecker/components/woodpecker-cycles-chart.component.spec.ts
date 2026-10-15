import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WoodpeckerCyclesChartComponent } from '@features/woodpecker/components/woodpecker-cycles-chart/woodpecker-cycles-chart.component';
import { summarizeCycle } from '@features/woodpecker/utils/woodpecker-stats.util';
import { resultado, vuelta } from '@tests/support/pajaro-carpintero';
import { translocoParaPruebas } from '@tests/support/racha-ajustes-recordatorios';

/** Vuelta de 10 ejercicios con `aciertos` resueltos y `ms` de tiempo total. */
function resumen(cycle: number, aciertos: number, ms: number) {
  const uids = Array.from({ length: 10 }, (_, i) => `p${i}`);
  return summarizeCycle(
    vuelta(
      cycle,
      uids,
      uids.map((uid, i) => resultado(uid, i < aciertos, ms / 10)),
      { finishedAt: 1 }
    )
  );
}

describe('WoodpeckerCyclesChartComponent', () => {
  let fixture: ComponentFixture<WoodpeckerCyclesChartComponent>;

  function pintar(summaries = [resumen(1, 7, 100_000), resumen(2, 9, 60_000)]) {
    fixture.componentInstance.summaries = summaries;
    fixture.detectChanges();
  }

  const filas = () =>
    Array.from(fixture.nativeElement.querySelectorAll('[data-testid=cycle-row]')) as HTMLElement[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WoodpeckerCyclesChartComponent, translocoParaPruebas()],
    }).compileComponents();
    fixture = TestBed.createComponent(WoodpeckerCyclesChartComponent);
  });

  it('pinta una fila por vuelta terminada', () => {
    pintar([resumen(1, 7, 100_000), resumen(2, 9, 60_000), resumen(3, 10, 40_000)]);

    expect(filas()).toHaveLength(3);
  });

  it('sin vueltas no pinta filas', () => {
    pintar([]);
    expect(filas()).toHaveLength(0);
  });

  it('enseña el acierto y el tiempo de cada vuelta', () => {
    pintar();

    expect(filas()[0].textContent).toContain('70 %');
    expect(filas()[0].textContent).toContain('1:40');
    expect(filas()[1].textContent).toContain('90 %');
    expect(filas()[1].textContent).toContain('1:00');
  });

  it('la primera vuelta no tiene cambios que mostrar', () => {
    pintar();

    expect(filas()[0].querySelector('[data-testid=accuracy-delta]')).toBeNull();
    expect(filas()[0].querySelector('[data-testid=time-delta]')).toBeNull();
  });

  it('desde la segunda dice cuánto cambió el acierto y el tiempo', () => {
    pintar();

    const acierto = filas()[1].querySelector('[data-testid=accuracy-delta]') as HTMLElement;
    const tiempo = filas()[1].querySelector('[data-testid=time-delta]') as HTMLElement;
    expect(acierto.textContent).toContain('WOODPECKER.progress.moreAccurate');
    expect(acierto.classList).toContain('text-success');
    expect(tiempo.textContent).toContain('WOODPECKER.progress.faster');
    expect(tiempo.classList).toContain('text-success');
  });

  it('empeorar se pinta en rojo y con el texto contrario', () => {
    pintar([resumen(1, 9, 60_000), resumen(2, 6, 90_000)]);

    const acierto = filas()[1].querySelector('[data-testid=accuracy-delta]') as HTMLElement;
    const tiempo = filas()[1].querySelector('[data-testid=time-delta]') as HTMLElement;
    expect(acierto.textContent).toContain('WOODPECKER.progress.lessAccurate');
    expect(acierto.classList).toContain('text-error');
    expect(tiempo.textContent).toContain('WOODPECKER.progress.slower');
    expect(tiempo.classList).toContain('text-error');
  });

  it('un cambio que se redondea a 0 no se enseña', () => {
    pintar([resumen(1, 8, 100_000), resumen(2, 8, 100_000)]);

    expect(filas()[1].querySelector('[data-testid=accuracy-delta]')).toBeNull();
    expect(filas()[1].querySelector('[data-testid=time-delta]')).toBeNull();
  });

  it('la barra de tiempo se mide contra la vuelta más lenta', () => {
    pintar();

    const barras = filas().map(
      (fila) => (fila.querySelectorAll('progress')[1] as HTMLProgressElement).value
    );
    expect(barras).toEqual([100, 60]);
  });
});
