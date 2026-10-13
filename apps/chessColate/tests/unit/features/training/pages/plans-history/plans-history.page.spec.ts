import { CommonModule } from '@angular/common';
import { Component, CUSTOM_ELEMENTS_SCHEMA, Input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { AlertController } from '@ionic/angular/standalone';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { Block, Plan, UserPuzzle } from '@chesspark/models';
import { PlanFacadeService } from '@chesspark/state';
import { SecondsToMinutesSecondsPipe } from '@chesspark/common-utils';

import { AppService } from '@core/app/app.service';
import { PlanStorageService } from '@features/training/services/plan-storage.service';

import { PlansHistoryPage } from '@features/training/pages/plans-history/plans-history.page';

import {
  findButtonByIcon,
  iconName,
  iconNames,
  makeBlock,
  makePlan,
  silenceIonIconNoise,
  textOf,
  translocoModule,
} from '@tests/support/puzzles-pages';

// Los componentes compartidos se sustituyen por versiones mínimas que muestran
// lo que reciben: aquí se prueba qué datos les pasa la pantalla.
@Component({ selector: 'app-count-up', standalone: true, template: 'sube:{{ from }}->{{ to }}' })
class CountUpStub {
  @Input() from = 0;
  @Input() to = 0;
}

@Component({ selector: 'app-elo-delta', standalone: true, template: 'delta:{{ delta }}' })
class EloDeltaStub {
  @Input() delta = 0;
}

@Component({ selector: 'app-navbar', standalone: true, template: '' })
class NavbarStub {}

const TRANSLATIONS = {
  PLANS_HISTORY: {
    today: 'Hoy',
    yesterday: 'Ayer',
    daysAgo: 'Hace {{days}} días',
    planSaved: '{{count}} plan guardado',
    plansSaved: '{{count}} planes guardados',
    correct: '{{percent}}% correctos',
    types: {
      warmup: 'Calentamiento',
      backToCalm: 'Vuelta a la calma',
      custom: 'Personalizado',
      infinity: 'Infinito',
      reto333: 'Reto 333',
    },
  },
  TRAINING: { plans: { plan1: { title: 'Bullet' }, plan5: { title: 'Blitz+' } } },
};

/** Fecha local `daysAgo` días antes del "ahora" de la prueba, a la hora dada. */
function at(daysAgo: number, hour = 9, minute = 0): number {
  const d = new Date(2026, 2, 10 - daysAgo, hour, minute);
  return d.getTime();
}

function played(resolved: boolean, n: number): UserPuzzle[] {
  return Array.from({ length: n }, (_, i) => ({ uid: `u${i}`, resolved } as unknown as UserPuzzle));
}

function planOn(daysAgo: number, uid: string, overrides: Partial<Plan> = {}): Plan {
  return makePlan({
    uid,
    createdAt: at(daysAgo),
    blocks: [makeBlock({ puzzles: undefined, puzzlesPlayed: [] })],
    ...overrides,
  });
}

describe('PlansHistoryPage', () => {
  let fixture: ComponentFixture<PlansHistoryPage>;
  let component: PlansHistoryPage;
  let el: HTMLElement;
  let stored: Plan[];
  let planStorage: { getAllPlans: jest.Mock; deletePlan: jest.Mock };
  let planFacade: { updatePlan: jest.Mock };
  let router: { navigate: jest.Mock };
  let alertController: { create: jest.Mock };
  let appService: { getNameThemePuzzleByValue: jest.Mock; getThemePuzzleByValue: jest.Mock };

  function render(): void {
    fixture = TestBed.createComponent(PlansHistoryPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }

  const cards = () => Array.from(el.querySelectorAll<HTMLElement>('.timeline-group .card.shadow-sm'));
  const groupHeaders = () =>
    Array.from(el.querySelectorAll('.timeline-group > div:first-child span')).map((s) => textOf(s));

  beforeEach(async () => {
    silenceIonIconNoise();
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 2, 10, 15, 0));

    stored = [];
    planStorage = {
      getAllPlans: jest.fn(() => stored),
      deletePlan: jest.fn((uid: string) => {
        stored = stored.filter((p) => p.uid !== uid);
      }),
    };
    planFacade = { updatePlan: jest.fn() };
    router = { navigate: jest.fn() };
    alertController = { create: jest.fn().mockResolvedValue({ present: jest.fn() }) };
    appService = {
      getNameThemePuzzleByValue: jest.fn((v: string) => `Tema ${v}`),
      getThemePuzzleByValue: jest.fn((v: string) =>
        v === 'fork' ? { value: 'fork', img: 'fork.svg' } : undefined
      ),
    };

    await TestBed.configureTestingModule({
      imports: [PlansHistoryPage, translocoModule(TRANSLATIONS)],
      providers: [
        { provide: PlanStorageService, useValue: planStorage },
        { provide: PlanFacadeService, useValue: planFacade },
        { provide: Router, useValue: router },
        { provide: AlertController, useValue: alertController },
        { provide: AppService, useValue: appService },
      ],
    })
      .overrideComponent(PlansHistoryPage, {
        set: {
          imports: [
            CommonModule,
            TranslocoPipe,
            SecondsToMinutesSecondsPipe,
            NavbarStub,
            CountUpStub,
            EloDeltaStub,
          ],
          schemas: [CUSTOM_ELEMENTS_SCHEMA],
        },
      })
      .compileComponents();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('carga del historial', () => {
    it('sin rutinas guardadas muestra el estado vacío y ninguna lista', () => {
      render();

      expect(textOf(el)).toContain('PLANS_HISTORY.empty');
      expect(textOf(el)).toContain('PLANS_HISTORY.emptyDescription');
      expect(cards()).toHaveLength(0);
      expect(el.querySelector('.loading-spinner')).toBeNull();
      expect(textOf(el)).not.toContain('guardados');
    });

    it('muestra el total de rutinas guardadas y una tarjeta por rutina', () => {
      stored = [planOn(0, 'a'), planOn(1, 'b')];
      render();

      expect(cards()).toHaveLength(2);
      expect(textOf(el)).toContain('2 planes guardados');
    });

    it('el reto 333 no aparece en el historial ni cuenta en el total', () => {
      stored = [planOn(0, 'a'), planOn(0, 'reto', { planType: 'reto333' })];
      render();

      expect(cards()).toHaveLength(1);
      expect(component.plans.map((p) => p.uid)).toEqual(['a']);
      expect(textOf(el)).toContain('1 plan guardado');
    });

    it('si el almacenamiento falla muestra el estado vacío, no se queda cargando y deja el error en consola', () => {
      const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      planStorage.getAllPlans.mockImplementation(() => {
        throw new Error('storage roto');
      });
      render();

      expect(error).toHaveBeenCalledTimes(1);
      expect(component.isLoading).toBe(false);
      expect(textOf(el)).toContain('PLANS_HISTORY.empty');
      expect(cards()).toHaveLength(0);
    });
  });

  describe('agrupación por fecha', () => {
    it('agrupa por hoy, ayer, hace N días, y las más viejas por su fecha, de la más reciente a la más antigua', () => {
      stored = [
        planOn(0, 'hoy-2'),
        planOn(0, 'hoy-1'),
        planOn(1, 'ayer'),
        planOn(3, 'hace3'),
        planOn(65, 'vieja'),
      ].sort((a, b) => b.createdAt - a.createdAt);
      render();

      const headers = groupHeaders();
      expect(headers.slice(0, 3)).toEqual(['Hoy', 'Ayer', 'Hace 3 días']);
      expect(headers[3]).toMatch(/2025|ene|dic|ene\.|2026/);
      expect(headers).toHaveLength(4);
      expect(component.groupedPlans[0].plans).toHaveLength(2);
      expect(component.groupedPlans.map((g) => g.plans.length)).toEqual([2, 1, 1, 1]);
    });

    it('las fechas de más de una semana salen con el idioma activo', () => {
      stored = [planOn(65, 'vieja')];
      render();
      const es = groupHeaders()[0];

      TestBed.inject(TranslocoService).setActiveLang('en');
      component.loadPlans();
      fixture.detectChanges();
      const en = groupHeaders()[0];

      expect(es).toBe('4 ene 2026');
      expect(en).toBe('Jan 4, 2026');
    });

    it('una rutina de hace 25 horas cae en "Ayer" y una de hace 30 minutos, en "Hoy"', () => {
      stored = [
        makePlan({ uid: 'reciente', createdAt: at(0, 14, 30), blocks: [makeBlock()] }),
        makePlan({ uid: 'ayer', createdAt: new Date(2026, 2, 9, 14, 0).getTime(), blocks: [makeBlock()] }),
      ];
      render();

      expect(groupHeaders()).toEqual(['Hoy', 'Ayer']);
    });
  });

  describe('tarjeta de una rutina', () => {
    it('sin título muestra el nombre del tipo de rutina y su insignia; con título lo muestra y oculta la insignia', () => {
      stored = [
        planOn(0, 'a', { planType: 'warmup', title: undefined }),
        planOn(0, 'b', { planType: 'custom', title: 'Mi rutina' }),
      ];
      render();

      const [first, second] = cards();
      expect(textOf(first.querySelector('h3'))).toBe('Calentamiento');
      expect(textOf(first.querySelector('.badge-outline'))).toBe('Calentamiento');
      expect(textOf(second.querySelector('h3'))).toBe('Mi rutina');
      expect(second.querySelector('.badge-outline')).toBeNull();
    });

    it('getPlanTypeName traduce cada tipo de rutina', () => {
      render();

      expect(component.getPlanTypeName('plan1')).toBe('Bullet');
      expect(component.getPlanTypeName('plan5')).toBe('Blitz+');
      expect(component.getPlanTypeName('backToCalm')).toBe('Vuelta a la calma');
      expect(component.getPlanTypeName('infinity')).toBe('Infinito');
      expect(component.getPlanTypeName('reto333')).toBe('Reto 333');
    });

    it('la duración suma solo los bloques con tiempo y los ejercicios jugados suman todos los bloques', () => {
      stored = [
        planOn(0, 'a', {
          blocks: [
            makeBlock({ time: 300, puzzlesPlayed: played(true, 2) }),
            makeBlock({ time: -1, puzzlesCount: 5, puzzlesPlayed: played(false, 3) }),
            makeBlock({ time: 60, puzzlesPlayed: [] }),
          ],
        }),
      ];
      render();

      const info = textOf(cards()[0]);
      expect(info).toContain('06:00');
      expect(info).toContain('5 COMMON.chess.puzzles');
    });

    it.each([
      [8, 2, '80%', 'badge-success'],
      [7, 3, '70%', 'badge-success'],
      [6, 4, '60%', 'badge-warning'],
      [5, 5, '50%', 'badge-warning'],
      [4, 6, '40%', 'badge-error'],
    ])(
      '%i aciertos y %i fallos pintan "%s correctos" con la clase %s',
      (good, bad, label, cssClass) => {
        stored = [
          planOn(0, 'a', {
            blocks: [makeBlock({ puzzlesPlayed: [...played(true, good), ...played(false, bad)] })],
          }),
        ];
        render();

        const badge = cards()[0].querySelector('.badge:not(.badge-outline)') as HTMLElement;
        expect(textOf(badge)).toBe(`${label} correctos`);
        expect(badge.className).toContain(cssClass);
        expect(badge.className.match(/badge-(success|warning|error)/g)).toHaveLength(1);
      }
    );

    it('sin ejercicios jugados no muestra porcentaje de aciertos', () => {
      stored = [planOn(0, 'a')];
      render();

      expect(textOf(cards()[0])).not.toContain('correctos');
      expect(component.getSuccessRate(stored[0])).toBe(0);
    });

    it('si el elo subió, muestra la cuenta desde el elo de arranque y el delta; si no, el elo plano', () => {
      stored = [
        planOn(0, 'sube', { eloTotal: 1650, initialTotalElo: 1600 }),
        planOn(0, 'igual', { eloTotal: 1500, initialTotalElo: 1500 }),
        planOn(0, 'baja', { eloTotal: 1480, initialTotalElo: 1500 }),
        planOn(0, 'sin-inicial', { eloTotal: 1520 }),
        planOn(0, 'sin-elo'),
      ];
      render();

      const [sube, igual, baja, sinInicial, sinElo] = cards();
      expect(textOf(sube)).toContain('sube:1600->1650');
      expect(textOf(sube)).toContain('delta:50');
      for (const flat of [igual, baja, sinInicial]) {
        expect(textOf(flat)).not.toContain('sube:');
        expect(textOf(flat)).not.toContain('delta:');
      }
      expect(textOf(igual)).toContain('PLANS_HISTORY.elo: 1500');
      expect(textOf(baja)).toContain('PLANS_HISTORY.elo: 1480');
      expect(textOf(sinInicial)).toContain('PLANS_HISTORY.elo: 1520');
      expect(textOf(sinElo)).not.toContain('PLANS_HISTORY.elo');
    });

    it('getEloGain devuelve null si faltan datos o no hubo ganancia', () => {
      render();

      expect(component.getEloGain(makePlan({ eloTotal: 1700, initialTotalElo: 1650 }))).toBe(50);
      expect(component.getEloGain(makePlan({ eloTotal: 1650, initialTotalElo: 1650 }))).toBeNull();
      expect(component.getEloGain(makePlan({ eloTotal: 1600, initialTotalElo: 1650 }))).toBeNull();
      expect(component.getEloGain(makePlan({ eloTotal: 1600 }))).toBeNull();
      expect(component.getEloGain(makePlan({ initialTotalElo: 1600 }))).toBeNull();
    });

    it('el detalle de bloques lista cada bloque con su título o "Bloque N", su tema y su configuración', () => {
      stored = [
        planOn(0, 'a', {
          blocks: [
            makeBlock({ title: 'Mates', description: 'Para calentar', theme: 'fork', time: 120, puzzlesCount: 0 }),
            makeBlock({ title: undefined, theme: 'all', time: -1, puzzlesCount: 10 }),
            makeBlock({ title: undefined, theme: 'weakness', time: 60, puzzlesCount: 5 }),
            makeBlock({ title: undefined, theme: 'pin', time: -1, puzzlesCount: 0 }),
          ],
        }),
      ];
      render();

      const blockCards = Array.from(cards()[0].querySelectorAll('.collapse-content .card'));
      expect(textOf(cards()[0].querySelector('.collapse-title'))).toBe('PUBLIC_PLANS.viewBlocks (4)');
      expect(blockCards).toHaveLength(4);

      expect(textOf(blockCards[0])).toContain('Mates');
      expect(textOf(blockCards[0])).toContain('Para calentar');
      expect(textOf(blockCards[0])).toContain('Tema fork');
      expect(textOf(blockCards[0])).toContain('02:00');
      expect(blockCards[0].querySelector('img')?.getAttribute('src')).toBe(
        '/assets/images/puzzle-themes/fork.svg'
      );

      expect(textOf(blockCards[1])).toContain('PUBLIC_PLANS.block 2');
      expect(textOf(blockCards[1])).toContain('10 NEW_BLOCK.fields.puzzles');
      expect(iconNames(blockCards[1])).toEqual(['shuffle']);

      expect(iconNames(blockCards[2])).toEqual(['trending-down']);
      expect(textOf(blockCards[2])).toContain('01:00 NEW_BLOCK.form.or 5 NEW_BLOCK.fields.puzzles');

      expect(iconNames(blockCards[3])).toEqual(['infinite-outline']);
      expect(blockCards[3].querySelector('img')).toBeNull();
    });
  });

  describe('acciones', () => {
    it('tocar la tarjeta guarda la rutina en el store y abre su detalle con el uid', () => {
      stored = [planOn(0, 'a')];
      render();

      cards()[0].click();

      expect(planFacade.updatePlan).toHaveBeenCalledWith(stored[0]);
      expect(router.navigate).toHaveBeenCalledWith(['/puzzles/plan-played'], {
        queryParams: { uid: 'a' },
      });
    });

    it('el botón del ojo abre el detalle una sola vez (el clic no se duplica con el de la tarjeta)', () => {
      stored = [planOn(0, 'a')];
      render();

      findButtonByIcon(cards()[0], 'eye')?.click();

      expect(router.navigate).toHaveBeenCalledTimes(1);
      expect(planFacade.updatePlan).toHaveBeenCalledTimes(1);
    });

    it('abrir el detalle de una rutina conserva los datos de esa rutina entre varias', () => {
      stored = [planOn(0, 'a'), planOn(1, 'b')];
      render();

      findButtonByIcon(cards()[1], 'eye')?.click();

      expect(planFacade.updatePlan).toHaveBeenCalledWith(expect.objectContaining({ uid: 'b' }));
      expect(router.navigate).toHaveBeenCalledWith(['/puzzles/plan-played'], {
        queryParams: { uid: 'b' },
      });
    });

    it('la papelera pide confirmación sin abrir el detalle ni borrar todavía', async () => {
      stored = [planOn(0, 'a')];
      render();

      findButtonByIcon(cards()[0], 'trash')?.click();
      await Promise.resolve();

      expect(alertController.create).toHaveBeenCalledTimes(1);
      expect(router.navigate).not.toHaveBeenCalled();
      expect(planStorage.deletePlan).not.toHaveBeenCalled();
      const alert = await alertController.create.mock.results[0].value;
      expect(alert.present).toHaveBeenCalledTimes(1);
    });

    it('confirmar "Eliminar" borra la rutina y la saca de la lista', async () => {
      stored = [planOn(0, 'a'), planOn(1, 'b')];
      render();
      findButtonByIcon(cards()[0], 'trash')?.click();
      await Promise.resolve();

      const buttons = alertController.create.mock.calls[0][0].buttons;
      const confirm = buttons.find((b: { text: string }) => b.text === 'Eliminar');
      expect(confirm.role).toBe('destructive');
      confirm.handler();
      fixture.detectChanges();

      expect(planStorage.deletePlan).toHaveBeenCalledWith('a');
      expect(cards()).toHaveLength(1);
      expect(component.plans.map((p) => p.uid)).toEqual(['b']);
    });

    it('cancelar no borra nada', async () => {
      stored = [planOn(0, 'a')];
      render();
      findButtonByIcon(cards()[0], 'trash')?.click();
      await Promise.resolve();

      const buttons = alertController.create.mock.calls[0][0].buttons;
      const cancel = buttons.find((b: { text: string }) => b.text === 'Cancelar');

      expect(cancel.role).toBe('cancel');
      expect(cancel.handler).toBeUndefined();
      expect(planStorage.deletePlan).not.toHaveBeenCalled();
      expect(cards()).toHaveLength(1);
    });

    it('borrar la última rutina deja el estado vacío', async () => {
      stored = [planOn(0, 'a')];
      render();
      findButtonByIcon(cards()[0], 'trash')?.click();
      await Promise.resolve();

      alertController.create.mock.calls[0][0].buttons[1].handler();
      fixture.detectChanges();

      expect(textOf(el)).toContain('PLANS_HISTORY.empty');
      expect(cards()).toHaveLength(0);
    });

    it('el enlace de inicio navega a /home', () => {
      render();

      el.querySelector<HTMLAnchorElement>('.breadcrumbs a')?.click();

      expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });
  });

  describe('racha de días', () => {
    const streakText = () => textOf(el.querySelector('.rounded-full.shadow-sm'));
    const flameName = () => iconName(el.querySelector('.rounded-full.shadow-sm ion-icon'));

    it('sin rutinas la racha es 0 y está apagada', () => {
      render();

      expect(streakText()).toBe('0 PLANS_HISTORY.days');
      expect(flameName()).toBe('flame-outline');
      expect(component.isStreakActive).toBe(false);
    });

    it('una rutina hoy da racha de 1 día, en singular y con la llama encendida', () => {
      stored = [planOn(0, 'a')];
      render();

      expect(streakText()).toBe('1 PLANS_HISTORY.day');
      expect(flameName()).toBe('flame');
      expect(component.isStreakActive).toBe(true);
    });

    it('cuenta los días seguidos hacia atrás desde hoy', () => {
      stored = [planOn(0, 'a'), planOn(1, 'b'), planOn(2, 'c')].sort(
        (x, y) => y.createdAt - x.createdAt
      );
      render();

      expect(component.streakDays).toBe(3);
      expect(streakText()).toBe('3 PLANS_HISTORY.days');
    });

    it('un hueco corta la racha: cuenta solo los días seguidos hasta el hueco', () => {
      stored = [planOn(0, 'a'), planOn(1, 'b'), planOn(3, 'c'), planOn(4, 'd')];
      render();

      expect(component.streakDays).toBe(2);
    });

    it('varias rutinas el mismo día cuentan como un solo día', () => {
      stored = [planOn(0, 'a'), planOn(0, 'b'), planOn(0, 'c')];
      render();

      expect(component.streakDays).toBe(1);
    });

    it('si la última rutina fue ayer la racha está en 0 y apagada (hoy aún no entrenó)', () => {
      stored = [planOn(1, 'a'), planOn(2, 'b')];
      render();

      expect(component.streakDays).toBe(0);
      expect(component.isStreakActive).toBe(false);
      expect(flameName()).toBe('flame-outline');
    });

    it('el reto 333 no cuenta para la racha', () => {
      stored = [planOn(0, 'reto', { planType: 'reto333' }), planOn(1, 'a')];
      render();

      expect(component.streakDays).toBe(0);
    });
  });
});
