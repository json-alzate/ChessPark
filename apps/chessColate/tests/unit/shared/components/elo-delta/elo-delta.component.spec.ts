import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EloDeltaComponent } from '@shared/components/elo-delta/elo-delta.component';

describe('EloDeltaComponent', () => {
  let fixture: ComponentFixture<EloDeltaComponent>;

  const host = () => fixture.nativeElement as HTMLElement;
  const shown = () => (host().querySelector('app-count-up')?.textContent ?? '').trim();
  const iconName = () => host().querySelector('ion-icon')?.getAttribute('name') ?? null;

  function render(inputs: { delta: number; animate?: boolean; duration?: number }) {
    fixture = TestBed.createComponent(EloDeltaComponent);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined); // Ionicons sin runtime
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('si subió', () => {
    beforeEach(() => render({ delta: 24, duration: 1000 }));

    it('muestra el gráfico que sube, en verde, y la cantidad sin signo', () => {
      jest.advanceTimersByTime(2000);
      fixture.detectChanges();

      expect(iconName()).toBe('trending-up');
      expect(host().classList).toContain('text-success');
      expect(host().classList).not.toContain('text-error');
      expect(shown()).toBe('24');
    });

    it('el número cuenta desde 0 en vez de aparecer de golpe', () => {
      expect(shown()).toBe('0');

      jest.advanceTimersByTime(2000);
      fixture.detectChanges();
      expect(shown()).toBe('24');
    });

    it('el lector de pantalla oye el signo: "+24"', () => {
      expect(host().getAttribute('aria-label')).toBe('+24');
    });
  });

  describe('si bajó', () => {
    beforeEach(() => render({ delta: -15 }));

    it('muestra el gráfico que baja, en rojo, y la cantidad sin signo', () => {
      expect(iconName()).toBe('trending-down');
      expect(host().classList).toContain('text-error');
      expect(host().classList).not.toContain('text-success');
      expect(shown()).toBe('15');
    });

    it('no anima aunque se pida: la cifra aparece completa', () => {
      expect(shown()).toBe('15');
    });

    it('el lector de pantalla oye el signo: "-15"', () => {
      expect(host().getAttribute('aria-label')).toBe('-15');
    });
  });

  describe('si no cambió', () => {
    beforeEach(() => render({ delta: 0 }));

    it('solo muestra el 0, atenuado y sin ícono', () => {
      expect(iconName()).toBeNull();
      expect(shown()).toBe('0');
      expect(host().classList).toContain('opacity-60');
      expect(host().classList).not.toContain('text-success');
      expect(host().classList).not.toContain('text-error');
      expect(host().getAttribute('aria-label')).toBe('0');
    });
  });

  it('con animate=false una subida muestra la cifra completa desde el principio', () => {
    render({ delta: 40, animate: false });

    expect(shown()).toBe('40');
  });

  it('si el delta cambia después, la vista se actualiza', () => {
    render({ delta: 10, animate: false });

    fixture.componentRef.setInput('delta', -30);
    fixture.detectChanges();

    expect(iconName()).toBe('trending-down');
    expect(shown()).toBe('30');
    expect(host().classList).toContain('text-error');
  });
});
