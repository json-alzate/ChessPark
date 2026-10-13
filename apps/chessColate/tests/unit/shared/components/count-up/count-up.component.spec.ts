import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CountUpComponent } from '@shared/components/count-up/count-up.component';

describe('CountUpComponent', () => {
  let fixture: ComponentFixture<CountUpComponent>;

  const shown = () => (fixture.nativeElement.textContent as string).trim();
  const setInputs = (inputs: Record<string, unknown>) => {
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
  };
  /** Avanza el reloj simulado (también mueve los cuadros de animación) y repinta. */
  const advance = (ms: number) => {
    jest.advanceTimersByTime(ms);
    fixture.detectChanges();
  };

  beforeEach(() => {
    jest.useFakeTimers();
    fixture = TestBed.createComponent(CountUpComponent);
  });

  afterEach(() => jest.useRealTimers());

  it('con animación arranca en el valor inicial', () => {
    setInputs({ from: 1500, to: 1560, duration: 1000 });

    expect(shown()).toBe('1500');
  });

  it('sube hasta el valor final al cumplirse la duración y se queda ahí', () => {
    setInputs({ from: 1500, to: 1560, duration: 1000 });

    advance(2000);

    expect(shown()).toBe('1560');
  });

  it('a mitad de camino ya subió pero aún no llegó', () => {
    setInputs({ from: 0, to: 100, duration: 1000 });

    advance(500);

    const midway = Number(shown());
    expect(midway).toBeGreaterThan(0);
    expect(midway).toBeLessThan(100);
  });

  it('el número nunca retrocede mientras sube', () => {
    setInputs({ from: 0, to: 100, duration: 1000 });
    const values: number[] = [];

    for (let i = 0; i < 20; i++) {
      advance(60);
      values.push(Number(shown()));
    }

    expect(values).toEqual([...values].sort((a, b) => a - b));
  });

  it('sin animación muestra el valor final de inmediato', () => {
    setInputs({ from: 0, to: 42, animate: false });

    expect(shown()).toBe('42');
  });

  it('si el inicio es igual al final no anima', () => {
    setInputs({ from: 7, to: 7 });

    expect(shown()).toBe('7');
  });

  it('por defecto cuenta desde 0', () => {
    setInputs({ to: 50, duration: 1000 });

    expect(shown()).toBe('0');
    advance(1500);
    expect(shown()).toBe('50');
  });

  it('también cuenta hacia abajo', () => {
    setInputs({ from: 100, to: 40, duration: 1000 });

    advance(1500);

    expect(shown()).toBe('40');
  });

  it('si cambia el destino vuelve a animar desde el inicio', () => {
    setInputs({ from: 0, to: 10, duration: 1000 });
    advance(2000);
    expect(shown()).toBe('10');

    setInputs({ to: 20 });
    expect(shown()).toBe('0'); // reinicia desde `from`

    advance(2000);
    expect(shown()).toBe('20');
  });

  it('al destruirse cancela el cuadro de animación pendiente', () => {
    const cancel = jest.spyOn(globalThis, 'cancelAnimationFrame');
    setInputs({ from: 0, to: 100, duration: 1000 });

    fixture.destroy();

    expect(cancel).toHaveBeenCalled();
    cancel.mockRestore();
  });

  it('sin requestAnimationFrame (entorno sin navegador) muestra el valor final', () => {
    const raf = globalThis.requestAnimationFrame;
    // @ts-expect-error simula un entorno sin animación de navegador
    delete globalThis.requestAnimationFrame;
    try {
      const noRaf = TestBed.createComponent(CountUpComponent);
      noRaf.componentRef.setInput('from', 0);
      noRaf.componentRef.setInput('to', 33);
      noRaf.detectChanges();

      expect((noRaf.nativeElement.textContent as string).trim()).toBe('33');
    } finally {
      globalThis.requestAnimationFrame = raf;
    }
  });
});
