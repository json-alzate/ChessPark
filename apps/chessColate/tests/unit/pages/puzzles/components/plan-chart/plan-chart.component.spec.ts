// chart.js necesita un canvas real (jsdom no lo implementa): se sustituye por un
// doble que solo recuerda con qué datos lo pintaría el componente.
jest.mock('chart.js', () => ({
  Chart: Object.assign(jest.fn(), { register: jest.fn() }),
  registerables: [],
}));

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { Chart } from 'chart.js';

import { Plan } from '@chesspark/models';

import { AppService } from '@services/app/app.service';
import { ProfileService } from '@services/account/profile.service';
import { PlansElosService } from '@services/plans/plans-elos.service';

import { PlanChartComponent } from '@app/pages/puzzles/components/plan-chart/plan-chart.component';

import {
  findButton,
  flushMicrotasks,
  makePlan,
  textOf,
  translocoModule,
} from '@tests/support/puzzles-pages';

const ChartMock = Chart as unknown as jest.Mock;

interface ChartCall {
  canvas: HTMLCanvasElement;
  labels: string[];
  data: number[];
  color: string;
}

function chartCalls(): ChartCall[] {
  return ChartMock.mock.calls.map(([canvas, config]) => ({
    canvas,
    labels: config.data.labels,
    data: config.data.datasets[0].data,
    color: config.data.datasets[0].backgroundColor,
  }));
}

/** Filas de la vista "Lista": nombre y elo de cada una. */
function listRows(el: HTMLElement): string[] {
  return Array.from(el.querySelectorAll('.card.bg-base-200')).map(
    (r) => `${textOf(r.querySelector('h2'))} ${textOf(r.querySelector('.badge'))}`
  );
}

describe('PlanChartComponent', () => {
  let fixture: ComponentFixture<PlanChartComponent>;
  let component: PlanChartComponent;
  let profileService: {
    subscribeToProfile: jest.Mock;
    getElosThemesByPlanType: jest.Mock;
    getElosOpeningsByPlanType: jest.Mock;
    getEloTotalByPlanType: jest.Mock;
  };
  let plansElosService: { getOnePlanElo: jest.Mock };
  let appService: { getNameThemePuzzleByValue: jest.Mock; getNameOpeningByValue: jest.Mock };

  async function render(plan: Plan, inputs: Partial<PlanChartComponent> = {}): Promise<HTMLElement> {
    fixture = TestBed.createComponent(PlanChartComponent);
    component = fixture.componentInstance;
    component.plan = plan;
    Object.assign(component, inputs);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  /** Avanza el reloj hasta que el componente termina de cargar y pintar. */
  async function finishLoading(): Promise<void> {
    jest.advanceTimersByTime(1000); // espera inicial de la vista
    await flushMicrotasks();
    jest.advanceTimersByTime(100); // espera a que existan los canvas
    fixture.detectChanges();
  }

  beforeEach(async () => {
    jest.useFakeTimers();
    ChartMock.mockClear();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);

    profileService = {
      subscribeToProfile: jest.fn(() => of(null)),
      getElosThemesByPlanType: jest.fn().mockReturnValue({}),
      getElosOpeningsByPlanType: jest.fn().mockReturnValue({}),
      getEloTotalByPlanType: jest.fn().mockReturnValue(1500),
    };
    plansElosService = { getOnePlanElo: jest.fn() };
    appService = {
      getNameThemePuzzleByValue: jest.fn((v: string) => `T:${v}`),
      getNameOpeningByValue: jest.fn((v: string) => `A:${v}`),
    };

    await TestBed.configureTestingModule({
      imports: [PlanChartComponent, translocoModule()],
      providers: [
        { provide: ProfileService, useValue: profileService },
        { provide: PlansElosService, useValue: plansElosService },
        { provide: AppService, useValue: appService },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('mientras carga muestra el indicador y todavía no pide ningún dato', async () => {
    const el = await render(makePlan());

    expect(el.querySelector('.loading-spinner')).not.toBeNull();
    jest.advanceTimersByTime(999);
    expect(profileService.getElosThemesByPlanType).not.toHaveBeenCalled();
    expect(ChartMock).not.toHaveBeenCalled();
  });

  describe('rutina por defecto', () => {
    beforeEach(() => {
      profileService.getEloTotalByPlanType.mockReturnValue(1720);
      profileService.getElosThemesByPlanType.mockReturnValue({
        fork: 1500,
        mateIn1: 1900,
        pin: 1700,
      });
      profileService.getElosOpeningsByPlanType.mockReturnValue({
        Sicilian: 1400,
        French: 1800,
      });
    });

    it('lee los elos del perfil para el tipo de rutina y muestra el elo total encima', async () => {
      const el = await render(makePlan({ planType: 'plan10' }));
      await finishLoading();

      expect(profileService.getElosThemesByPlanType).toHaveBeenCalledWith('plan10');
      expect(profileService.getElosOpeningsByPlanType).toHaveBeenCalledWith('plan10');
      expect(profileService.getEloTotalByPlanType).toHaveBeenCalledWith('plan10');
      expect(plansElosService.getOnePlanElo).not.toHaveBeenCalled();
      expect(textOf(el.querySelector('h3'))).toBe('1720');
      expect(el.querySelector('.loading-spinner')).toBeNull();
    });

    it('con showEloPlanHeader en false no pinta el elo total', async () => {
      const el = await render(makePlan(), { showEloPlanHeader: false });
      await finishLoading();

      expect(el.querySelector('h3')).toBeNull();
    });

    it('dibuja cuatro radares (temas y aperturas, mejores y peores) con los elos ordenados de mayor a menor y nombres traducidos', async () => {
      const el = await render(makePlan());
      await finishLoading();

      const calls = chartCalls();
      expect(calls).toHaveLength(4);
      const canvases = Array.from(el.querySelectorAll('canvas'));
      expect(calls.map((c) => c.canvas)).toEqual(canvases);

      expect(calls[0].labels).toEqual(['T:mateIn1', 'T:pin', 'T:fork']);
      expect(calls[0].data).toEqual([1900, 1700, 1500]);
      expect(calls[2].labels).toEqual(['A:French', 'A:Sicilian']);
      expect(calls[2].data).toEqual([1800, 1400]);
      // Verde para los mejores, rojo para los peores.
      expect(calls[0].color).toContain('47, 223, 117');
      expect(calls[1].color).toContain('255, 73, 97');
    });

    it('el radar de los mejores toma los 7 primeros y el de los peores los 7 últimos', async () => {
      const themes: Record<string, number> = {};
      for (let i = 1; i <= 9; i++) themes[`t${i}`] = 1000 + i * 10;
      profileService.getElosThemesByPlanType.mockReturnValue(themes);
      await render(makePlan());
      await finishLoading();

      const [up, down] = chartCalls();
      expect(up.labels).toEqual(['T:t9', 'T:t8', 'T:t7', 'T:t6', 'T:t5', 'T:t4', 'T:t3']);
      expect(up.data[0]).toBe(1090);
      expect(down.labels).toEqual(['T:t7', 'T:t6', 'T:t5', 'T:t4', 'T:t3', 'T:t2', 'T:t1']);
      expect(down.data[6]).toBe(1010);
    });

    it('si el catálogo no conoce un tema o una apertura usa su clave como nombre', async () => {
      appService.getNameThemePuzzleByValue.mockReturnValue('');
      appService.getNameOpeningByValue.mockReturnValue('');
      await render(makePlan());
      await finishLoading();

      expect(component.themesLabels).toEqual(['mateIn1', 'pin', 'fork']);
      expect(component.openingsLabels).toEqual(['French', 'Sicilian']);
    });

    it('un perfil sin elos por tema deja el gráfico vacío sin romper', async () => {
      profileService.getElosThemesByPlanType.mockReturnValue({});
      profileService.getElosOpeningsByPlanType.mockReturnValue({});
      const el = await render(makePlan());
      await finishLoading();

      expect(chartCalls()[0].labels).toEqual([]);
      expect(el.querySelector('.loading-spinner')).toBeNull();
    });
  });

  describe('rutina personalizada', () => {
    it('toma los elos de la propia rutina y no del perfil', async () => {
      plansElosService.getOnePlanElo.mockResolvedValue({
        total: 1333,
        themes: { fork: 1400, pin: 1600 },
        openings: { French: 1250 },
      });
      const el = await render(makePlan({ planType: 'custom', uidCustomPlan: 'cp-1' }));
      await finishLoading();

      expect(plansElosService.getOnePlanElo).toHaveBeenCalledWith('cp-1');
      expect(profileService.getElosThemesByPlanType).not.toHaveBeenCalled();
      expect(profileService.getEloTotalByPlanType).not.toHaveBeenCalled();
      expect(textOf(el.querySelector('h3'))).toBe('1333');
      expect(chartCalls()[0].labels).toEqual(['T:pin', 'T:fork']);
      expect(chartCalls()[2].labels).toEqual(['A:French']);
    });

    it('una rutina recién creada (sin total ni temas) arranca en 1500 y sin datos', async () => {
      plansElosService.getOnePlanElo.mockResolvedValue({});
      const el = await render(makePlan({ planType: 'custom', uidCustomPlan: 'cp-1' }));
      await finishLoading();

      expect(textOf(el.querySelector('h3'))).toBe('1500');
      expect(chartCalls()[0].labels).toEqual([]);
    });

    it('una rutina custom sin uidCustomPlan cae al perfil por tipo de rutina', async () => {
      await render(makePlan({ planType: 'custom', uidCustomPlan: undefined }));
      await finishLoading();

      expect(plansElosService.getOnePlanElo).not.toHaveBeenCalled();
      expect(profileService.getElosThemesByPlanType).toHaveBeenCalledWith('custom');
    });
  });

  describe('pestañas', () => {
    beforeEach(() => {
      profileService.getElosThemesByPlanType.mockReturnValue({ fork: 1500, pin: 1700 });
      profileService.getElosOpeningsByPlanType.mockReturnValue({ French: 1800, Sicilian: 1400 });
    });

    it('arranca en temas (mejores) y alternar a aperturas cambia los controles visibles', async () => {
      const el = await render(makePlan());
      await finishLoading();
      expect(component.segment).toBe('themesUp');
      expect(el.querySelector('canvas:not(.hide)')).toBe(el.querySelectorAll('canvas')[0]);

      findButton(el, 'PLAN_CHART.openings')?.click();
      fixture.detectChanges();

      expect(component.segment).toBe('openingsUp');
      expect(el.querySelector('canvas:not(.hide)')).toBe(el.querySelectorAll('canvas')[2]);
      expect(findButton(el, 'PLAN_CHART.themes')?.className).not.toContain('tab-active');
      expect(findButton(el, 'PLAN_CHART.openings')?.className).toContain('tab-active');
    });

    it('"Peores" muestra el radar de los peores temas y "Lista" oculta los radares y enumera cada tema con su elo', async () => {
      const el = await render(makePlan());
      await finishLoading();

      findButton(el, 'PLAN_CHART.bottom')?.click();
      fixture.detectChanges();
      expect(component.segment).toBe('themesDown');
      expect(el.querySelector('canvas:not(.hide)')).toBe(el.querySelectorAll('canvas')[1]);

      findButton(el, 'PLAN_CHART.list')?.click();
      fixture.detectChanges();

      expect(el.querySelector('canvas:not(.hide)')).toBeNull();
      const rows = listRows(el);
      expect(rows).toEqual(['T:pin 1700', 'T:fork 1500']);
    });

    it('la lista de aperturas muestra cada apertura con su elo', async () => {
      const el = await render(makePlan());
      await finishLoading();

      findButton(el, 'PLAN_CHART.openings')?.click();
      fixture.detectChanges();
      findButton(el, 'PLAN_CHART.list')?.click();
      fixture.detectChanges();

      const rows = listRows(el);
      expect(rows).toEqual(['A:French 1800', 'A:Sicilian 1400']);
    });
  });
});
