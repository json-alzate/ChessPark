import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WoodpeckerDashboardComponent } from '@features/woodpecker/components/woodpecker-dashboard/woodpecker-dashboard.component';
import { WoodpeckerCycle } from '@features/woodpecker/models/woodpecker.model';
import {
  ejercicios,
  estadoConProgreso,
  resultado,
  vuelta,
} from '@tests/support/pajaro-carpintero';
import { translocoParaPruebas } from '@tests/support/racha-ajustes-recordatorios';

const UIDS = ['p1', 'p2', 'p3', 'p4'];
const puzzles = ejercicios(4);

function terminada(n: number, resueltos: string[] = UIDS): WoodpeckerCycle {
  return vuelta(
    n,
    UIDS,
    UIDS.map((uid) => resultado(uid, resueltos.includes(uid), 5_000)),
    { finishedAt: n * 100 }
  );
}

describe('WoodpeckerDashboardComponent', () => {
  let fixture: ComponentFixture<WoodpeckerDashboardComponent>;

  function pintar(
    estado: ReturnType<typeof estadoConProgreso>,
    extra: Partial<WoodpeckerDashboardComponent> = {}
  ) {
    fixture.componentRef.setInput('state', estado);
    Object.assign(fixture.componentInstance, { themeNames: ['Ataque doble', 'Clavada'], ...extra });
    fixture.detectChanges();
  }

  const el = (id: string) =>
    fixture.nativeElement.querySelector(`[data-testid=${id}]`) as HTMLElement | null;
  const texto = (id: string) => el(id)?.textContent ?? '';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WoodpeckerDashboardComponent, translocoParaPruebas()],
    }).compileComponents();
    fixture = TestBed.createComponent(WoodpeckerDashboardComponent);
  });

  describe('set sin empezar', () => {
    beforeEach(() => pintar(estadoConProgreso(puzzles, [])));

    it('enseña el set: tamaño y rango de ELO', () => {
      expect(texto('set-card')).toContain('WOODPECKER.dashboard.exercises');
      expect(texto('set-card')).toContain('1300 – 1700');
    });

    it('señala la vuelta 1 y ofrece empezarla', () => {
      expect(texto('cycle-badge')).toContain('WOODPECKER.dashboard.cycleOf');
      expect(texto('play')).toContain('WOODPECKER.dashboard.start');
      expect(el('active-progress')).toBeNull();
    });

    it('la evolución está vacía y se explica por qué', () => {
      expect(el('evolution-empty')).not.toBeNull();
    });

    it('permite abandonar el set', () => {
      expect(el('discard')).not.toBeNull();
      expect(texto('discard')).toContain('WOODPECKER.dashboard.discard');
    });

    it('enseña el reloj de la vuelta que toca', () => {
      expect(fixture.componentInstance.nextCycleSeconds).toBe(60);
      expect(texto('set-card')).toContain('WOODPECKER.dashboard.secondsPerExercise');
    });
  });

  describe('vuelta a medias', () => {
    beforeEach(() =>
      pintar(
        estadoConProgreso(puzzles, [
          vuelta(1, UIDS, [resultado('p1', true), resultado('p2', false)]),
        ])
      )
    );

    it('ofrece continuar en vez de empezar y enseña lo jugado', () => {
      expect(texto('play')).toContain('WOODPECKER.dashboard.resume');
      expect(el('active-progress')).not.toBeNull();
      expect(fixture.componentInstance.activeProgress).toBe(50);
    });
  });

  describe('entre una vuelta y otra', () => {
    beforeEach(() => pintar(estadoConProgreso(puzzles, [terminada(1)])));

    it('apunta a la vuelta 2 y su reloj baja', () => {
      expect(fixture.componentInstance.nextCycle).toBe(2);
      expect(fixture.componentInstance.nextCycleSeconds).toBe(48);
      expect(texto('play')).toContain('WOODPECKER.dashboard.start');
    });

    it('ya hay evolución que mostrar', () => {
      expect(el('evolution-empty')).toBeNull();
      expect(el('evolution')?.querySelector('app-woodpecker-cycles-chart')).not.toBeNull();
    });
  });

  describe('set terminado', () => {
    beforeEach(() =>
      pintar(
        estadoConProgreso(puzzles, [terminada(1), terminada(2), terminada(3)], { completedAt: 300 })
      )
    );

    it('lo celebra y ofrece armar otro set, sin botón de jugar', () => {
      expect(el('completed-card')).not.toBeNull();
      expect(el('new-set')).not.toBeNull();
      expect(el('play')).toBeNull();
    });

    it('ya no habla del reloj de ninguna vuelta', () => {
      expect(texto('set-card')).not.toContain('secondsPerExercise');
      expect(texto('set-card')).not.toContain('noClock');
    });

    it('el borrado no se presenta como abandono', () => {
      expect(texto('discard')).toContain('WOODPECKER.dashboard.deleteSet');
    });
  });

  it('sin reloj lo dice en vez de enseñar segundos', () => {
    pintar(estadoConProgreso(puzzles, [], { config: { timing: 'none' } }));

    expect(fixture.componentInstance.nextCycleSeconds).toBeNull();
    expect(texto('set-card')).toContain('WOODPECKER.dashboard.noClock');
  });

  it('con muchos temas enseña unos pocos y cuenta el resto', () => {
    const nombres = Array.from({ length: 9 }, (_, i) => `Tema ${i}`);
    pintar(estadoConProgreso(puzzles, []), { themeNames: nombres });

    expect(fixture.nativeElement.querySelectorAll('.badge-outline')).toHaveLength(6);
    expect(texto('set-card')).toContain('+3');
  });

  describe('origen del set', () => {
    it('un set del catálogo no dice nada de archivos', () => {
      pintar(estadoConProgreso(puzzles, []));

      expect(el('source-pgn')).toBeNull();
    });

    it('un set de un PGN propio lo dice, con el nombre del archivo', () => {
      const estado = estadoConProgreso(puzzles, []);
      pintar({ ...estado, set: { ...estado.set, source: 'pgn', sourceName: 'mis-tacticas.pgn' } });

      expect(texto('source-pgn')).toContain('WOODPECKER.dashboard.fromPgn');
      expect(texto('source-pgn')).toContain('mis-tacticas.pgn');
    });

    it('si el texto se pegó (sin nombre de archivo) lo dice sin nombre', () => {
      const estado = estadoConProgreso(puzzles, []);
      pintar({ ...estado, set: { ...estado.set, source: 'pgn', sourceName: '' } });

      expect(texto('source-pgn').trim()).toBe('WOODPECKER.dashboard.fromPgn');
    });
  });

  it('avisa cuando salieron menos ejercicios de los pedidos', () => {
    pintar(estadoConProgreso(puzzles, []), { shortNotice: { requested: 100, actual: 87 } });

    expect(texto('short-notice')).toContain('WOODPECKER.shortNotice');
  });

  it('sin aviso no pinta nada de eso', () => {
    pintar(estadoConProgreso(puzzles, []));
    expect(el('short-notice')).toBeNull();
  });

  describe('ejercicios problemáticos', () => {
    it('no hay sección si no hay ninguno', () => {
      pintar(estadoConProgreso(puzzles, [terminada(1)]));
      expect(el('problems')).toBeNull();
    });

    it('los lista y avisa de cuál quiere ver el usuario', () => {
      pintar(estadoConProgreso(puzzles, [terminada(1, ['p2']), terminada(2, ['p2'])]), {
        problemItems: [{ uidPuzzle: 'p1', failures: 2, themes: 'Clavada', rating: 1500 }],
      });
      const visto: string[] = [];
      fixture.componentInstance.viewProblem.subscribe((uid) => visto.push(uid));

      (el('problems')?.querySelector('button') as HTMLButtonElement).click();

      expect(texto('problems')).toContain('Clavada');
      expect(visto).toEqual(['p1']);
    });
  });

  describe('acciones', () => {
    it('jugar, abandonar y armar otro se avisan a quien escucha', () => {
      pintar(estadoConProgreso(puzzles, []));
      const instancia = fixture.componentInstance;
      const jugar = jest.fn();
      const abandonar = jest.fn();
      instancia.play.subscribe(jugar);
      instancia.discard.subscribe(abandonar);

      (el('play') as HTMLButtonElement).click();
      (el('discard') as HTMLButtonElement).click();

      expect(jugar).toHaveBeenCalledTimes(1);
      expect(abandonar).toHaveBeenCalledTimes(1);
    });

    it('«armar otro set» solo existe con el set terminado y se avisa', () => {
      pintar(
        estadoConProgreso(puzzles, [terminada(1), terminada(2), terminada(3)], { completedAt: 300 })
      );
      const nuevo = jest.fn();
      fixture.componentInstance.newSet.subscribe(nuevo);

      (el('new-set') as HTMLButtonElement).click();

      expect(nuevo).toHaveBeenCalledTimes(1);
    });
  });
});
