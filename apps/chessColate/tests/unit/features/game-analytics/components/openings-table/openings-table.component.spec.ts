import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OpeningStats } from '@chesspark/game-reporter';
import { CatalogOpening } from '@features/game-analytics/utils/game-analytics.util';
import { OpeningsTableComponent } from '@features/game-analytics/components/openings-table/openings-table.component';

import { textoDe, translocoTesting } from '@tests/support/analisis-juegos';

function apertura(eco: string, name: string, games: number, overrides: Partial<OpeningStats> = {}): OpeningStats {
  const wins = Math.round(games / 2);
  return {
    eco,
    name,
    games,
    wins,
    draws: 0,
    losses: games - wins,
    winRate: wins / games,
    asWhite: games,
    asBlack: 0,
    ...overrides,
  };
}

const catalogo: CatalogOpening[] = [
  { value: 'Sicilian_Defense', nameEn: 'Sicilian Defense', nameEs: 'Defensa Siciliana' },
];

describe('OpeningsTableComponent', () => {
  let fixture: ComponentFixture<OpeningsTableComponent>;

  const filas = (): Element[] => Array.from(fixture.nativeElement.querySelectorAll('li'));
  const botonVerMas = () =>
    Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find((b) =>
      textoDe(b).includes('ANALYTICS.openings.showMore')
    );

  function entrada(valores: Record<string, unknown>) {
    for (const [clave, valor] of Object.entries(valores)) {
      fixture.componentRef.setInput(clave, valor);
    }
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OpeningsTableComponent, translocoTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(OpeningsTableComponent);
  });

  it('sin aperturas muestra el mensaje de que no hay suficientes partidas', () => {
    entrada({ openings: [] });
    expect(filas()).toHaveLength(0);
    expect(textoDe(fixture.nativeElement)).toContain('ANALYTICS.openings.empty');
  });

  it('oculta las aperturas con menos partidas que el mínimo', () => {
    entrada({
      openings: [apertura('B20', 'Sicilian Defense', 5), apertura('A00', 'Rara', 2)],
      minGames: 3,
    });
    expect(filas()).toHaveLength(1);
    expect(textoDe(filas()[0])).toContain('Sicilian Defense');
    expect(textoDe(fixture.nativeElement)).not.toContain('Rara');
  });

  it('si ninguna llega al mínimo, muestra el estado vacío', () => {
    entrada({ openings: [apertura('A00', 'Rara', 2)], minGames: 3 });
    expect(filas()).toHaveLength(0);
    expect(textoDe(fixture.nativeElement)).toContain('ANALYTICS.openings.empty');
  });

  it('muestra nombre, código ECO y el porcentaje de victorias redondeado', () => {
    entrada({ openings: [apertura('B20', 'Sicilian Defense', 3, { wins: 2, losses: 1, winRate: 0.6667 })] });
    const texto = textoDe(filas()[0]);
    expect(texto).toContain('B20');
    expect(texto).toContain('Sicilian Defense');
    expect(texto).toContain('67%');
  });

  it('la barra de resultados reparte victorias, tablas y derrotas', () => {
    entrada({ openings: [apertura('B20', 'X', 4, { wins: 2, draws: 1, losses: 1, winRate: 0.5 })] });
    const anchos = Array.from<HTMLElement>(filas()[0].querySelectorAll('.h-1\\.5 span')).map((s) => s.style.width);
    expect(anchos).toEqual(['50%', '25%', '25%']);
  });

  describe('paginación', () => {
    const muchas = Array.from({ length: 20 }, (_, i) => apertura(`A${i}`, `Apertura ${i}`, 10));

    it('muestra 8 filas y el botón de ver más', () => {
      entrada({ openings: muchas });
      expect(filas()).toHaveLength(8);
      expect(botonVerMas()).toBeDefined();
    });

    it('cada clic en ver más suma otras 8 filas hasta agotar la lista', () => {
      entrada({ openings: muchas });
      botonVerMas()?.click();
      fixture.detectChanges();
      expect(filas()).toHaveLength(16);
      botonVerMas()?.click();
      fixture.detectChanges();
      expect(filas()).toHaveLength(20);
      expect(botonVerMas()).toBeUndefined();
    });

    it('con 8 aperturas o menos no ofrece ver más', () => {
      entrada({ openings: muchas.slice(0, 8) });
      expect(filas()).toHaveLength(8);
      expect(botonVerMas()).toBeUndefined();
    });

    it('al cambiar las aperturas vuelve a la primera página', () => {
      entrada({ openings: muchas });
      botonVerMas()?.click();
      fixture.detectChanges();
      expect(filas()).toHaveLength(16);
      entrada({ openings: muchas.slice(0, 12) });
      expect(filas()).toHaveLength(8);
    });
  });

  describe('practicar', () => {
    it('ofrece practicar solo las aperturas que están en el catálogo y emite la elegida', () => {
      const emitidas: CatalogOpening[] = [];
      fixture.componentInstance.practice.subscribe((o) => emitidas.push(o));
      entrada({
        openings: [apertura('B20', 'Sicilian Defense: Najdorf', 6), apertura('A00', 'Rara', 6)],
        catalog: catalogo,
      });
      const practicar = fixture.nativeElement.querySelectorAll('button.btn-outline');
      expect(practicar).toHaveLength(1);
      expect(filas()[0].contains(practicar[0])).toBe(true);
      practicar[0].click();
      expect(emitidas).toEqual([catalogo[0]]);
    });

    it('sin catálogo no hay botones de practicar', () => {
      entrada({ openings: [apertura('B20', 'Sicilian Defense', 6)], catalog: [] });
      expect(fixture.nativeElement.querySelectorAll('button.btn-outline')).toHaveLength(0);
    });
  });
});
