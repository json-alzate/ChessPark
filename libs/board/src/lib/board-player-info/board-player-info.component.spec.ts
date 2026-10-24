import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BoardPlayerInfoComponent } from './board-player-info.component';

describe('BoardPlayerInfoComponent', () => {
  let fixture: ComponentFixture<BoardPlayerInfoComponent>;

  const texto = () => (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ').trim();

  function entrada(valores: Record<string, unknown>) {
    for (const [clave, valor] of Object.entries(valores)) {
      fixture.componentRef.setInput(clave, valor);
    }
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [BoardPlayerInfoComponent] }).compileComponents();
    fixture = TestBed.createComponent(BoardPlayerInfoComponent);
  });

  it('muestra el nombre y el rating entre paréntesis', () => {
    entrada({ name: 'Magnus', rating: 2830 });

    expect(texto()).toBe('Magnus (2830)');
  });

  it('sin rating solo muestra el nombre, sin paréntesis vacíos', () => {
    entrada({ name: 'Magnus', rating: null });

    expect(texto()).toBe('Magnus');
  });

  it('sin nombre muestra un guion', () => {
    entrada({ name: '' });

    expect(texto()).toBe('—');
  });

  it('muestra el reloj solo si lo hay', () => {
    entrada({ name: 'Magnus', clock: '9:58' });
    expect(texto()).toContain('9:58');

    entrada({ clock: '' });
    expect(texto()).toBe('Magnus');
  });
});
