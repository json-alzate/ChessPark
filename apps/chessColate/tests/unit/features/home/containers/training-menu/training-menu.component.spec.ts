import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { LoadingController } from '@ionic/angular/standalone';
import { TranslocoService } from '@jsverse/transloco';
import { BehaviorSubject } from 'rxjs';

import { Block, Profile } from '@chesspark/models';

import { TrainingMenuComponent } from '@features/home/containers/training-menu/training-menu.component';
import { TRAINING_PLAN_PRESETS } from '@features/training/config/training-plans.config';
import { ProfileService } from '@core/account/profile.service';
import { PlanService } from '@features/training/services/plan.service';
import { BlockService } from '@features/training/services/block.service';
import { provideTranslocoTesting } from '@tests/support/transloco-testing';

function makeBlock(label: string): Block {
  return { label, puzzles: [] } as unknown as Block;
}

describe('TrainingMenuComponent', () => {
  let component: TrainingMenuComponent;
  let fixture: ComponentFixture<TrainingMenuComponent>;

  let profile: Profile | null;
  let profile$: BehaviorSubject<Profile | null>;
  let profileService: { profile$: BehaviorSubject<Profile | null>; getProfile: Profile | null; getEloTotalByPlanType: jest.Mock };
  let blockService: { generateBlocksForPlan: jest.Mock; getPuzzlesForBlock: jest.Mock };
  let planService: { newPlan: jest.Mock };
  let router: { navigate: jest.Mock };
  let loader: { present: jest.Mock; dismiss: jest.Mock; message?: string };
  let loadingController: { create: jest.Mock };

  function setProfile(next: Profile | null) {
    profile = next;
    profileService.getProfile = next;
    profile$.next(next);
  }

  beforeEach(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    profile = null;
    profile$ = new BehaviorSubject<Profile | null>(null);
    profileService = {
      profile$,
      getProfile: null,
      getEloTotalByPlanType: jest.fn((planType: string) => {
        const total = (profile?.elos as Record<string, unknown> | undefined)?.[`${planType}Total`];
        return typeof total === 'number' ? total : 1500;
      }),
    };
    blockService = {
      generateBlocksForPlan: jest.fn().mockResolvedValue([makeBlock('a'), makeBlock('b')]),
      getPuzzlesForBlock: jest.fn().mockResolvedValue([{ uid: 'p1' }]),
    };
    planService = { newPlan: jest.fn().mockResolvedValue({ uid: 'plan-1' }) };
    router = { navigate: jest.fn() };
    loader = { present: jest.fn().mockResolvedValue(undefined), dismiss: jest.fn().mockResolvedValue(true) };
    loadingController = { create: jest.fn().mockResolvedValue(loader) };

    await TestBed.configureTestingModule({
      imports: [TrainingMenuComponent],
      providers: [
        provideTranslocoTesting(),
        { provide: ProfileService, useValue: profileService },
        { provide: BlockService, useValue: blockService },
        { provide: PlanService, useValue: planService },
        { provide: Router, useValue: router },
        { provide: LoadingController, useValue: loadingController },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TrainingMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => jest.restoreAllMocks());

  it('se crea', () => {
    expect(component).toBeTruthy();
  });

  it('la rutina recomendada es la de 10 minutos y el slider arranca ahí', () => {
    expect(TRAINING_PLAN_PRESETS[component.recommendedIndex].plan).toBe(10);
    expect(component.activeSlide).toBe(component.recommendedIndex);
  });

  it('pinta una tarjeta por rutina (en la versión móvil y en la de escritorio)', () => {
    const titles = Array.from(fixture.nativeElement.querySelectorAll('.card .font-bold.leading-tight')) as HTMLElement[];
    const text = titles.map((t) => t.textContent?.trim());

    for (const preset of TRAINING_PLAN_PRESETS) {
      expect(text.filter((t) => t === preset.titleKey).length).toBe(2);
    }
  });

  describe('ELO mostrado', () => {
    it('sin sesión es 1500 provisional', () => {
      expect(component.getEloDisplayForPlan(5)).toBe('1500?');
      expect(component.isEloProvisional(5)).toBe(true);
    });

    it('con sesión pero sin partidas en esa rutina sigue siendo provisional', () => {
      setProfile({ uid: 'u1', elos: { plan10Total: 1700 } } as unknown as Profile);

      expect(component.getEloDisplayForPlan(5)).toBe('1500?');
      expect(component.isEloProvisional(5)).toBe(true);
    });

    it('con ELO registrado en la rutina lo muestra sin signo de interrogación', () => {
      setProfile({ uid: 'u1', elos: { plan10Total: 1734 } } as unknown as Profile);

      expect(component.getEloDisplayForPlan(10)).toBe('1734');
      expect(component.isEloProvisional(10)).toBe(false);
    });

    it('al cambiar el perfil la pantalla se vuelve a pintar con el ELO nuevo', () => {
      setProfile({ uid: 'u1', elos: { plan10Total: 1734 } } as unknown as Profile);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('1734');
    });
  });

  describe('"qué entrenas"', () => {
    it('toggleBlocks revela una rutina, la oculta al repetir y cambia de una a otra', () => {
      const event = { stopPropagation: jest.fn() } as unknown as Event;

      component.toggleBlocks(5, event);
      expect(component.revealedPlan).toBe(5);

      component.toggleBlocks(10, event);
      expect(component.revealedPlan).toBe(10);

      component.toggleBlocks(10, event);
      expect(component.revealedPlan).toBeNull();
      expect(event.stopPropagation).toHaveBeenCalledTimes(3);
    });

    it('el panel abierto lista los bloques de la rutina con su duración m:ss', () => {
      component.toggleBlocks(5, new Event('click'));
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('TRAINING.plans.plan5.phases.p1');
      expect(text).toContain('2:30');
      expect(text).toContain('TRAINING.startRoutine');
    });

    it('formatDuration da minutos y segundos con cero a la izquierda', () => {
      expect(component.formatDuration(60)).toBe('1:00');
      expect(component.formatDuration(150)).toBe('2:30');
      expect(component.formatDuration(185)).toBe('3:05');
      expect(component.formatDuration(5)).toBe('0:05');
    });
  });

  it('el evento de cambio de slide actualiza la tarjeta activa', () => {
    component.onSlideChange(new CustomEvent('swiperslidechange', { detail: [{ activeIndex: 4 }] }));

    expect(component.activeSlide).toBe(4);
  });

  it('imageFor devuelve el animalito de la rutina', () => {
    expect(component.imageFor(TRAINING_PLAN_PRESETS[0])).toBe('assets/images/plan-icons/plan1.png');
  });

  describe('crear una rutina', () => {
    it('genera los bloques, carga los puzzles de cada uno, crea el plan y navega al entrenamiento', async () => {
      await component.createPlan(5);

      expect(blockService.generateBlocksForPlan).toHaveBeenCalledWith('plan5');
      expect(blockService.getPuzzlesForBlock).toHaveBeenCalledTimes(2);
      const [blocks, planType] = planService.newPlan.mock.calls[0];
      expect(planType).toBe('plan5');
      expect(blocks.map((b: Block) => b.puzzles)).toEqual([[{ uid: 'p1' }], [{ uid: 'p1' }]]);
      expect(router.navigate).toHaveBeenCalledWith(['/puzzles/training']);
    });

    it('muestra el cargando mientras prepara y lo cierra al terminar', async () => {
      await component.createPlan(3);

      expect(loader.present).toHaveBeenCalledTimes(1);
      expect(loader.dismiss).toHaveBeenCalledTimes(1);
      // y el cargando se cierra antes de navegar
      expect(loader.dismiss.mock.invocationCallOrder[0]).toBeLessThan(router.navigate.mock.invocationCallOrder[0]);
    });

    it('el mensaje del cargando avanza con los bloques cargados', async () => {
      const transloco = TestBed.inject(TranslocoService);
      jest.spyOn(transloco, 'translate').mockImplementation(((key: string, params?: { loaded: number; total: number }) =>
        params ? `${params.loaded}/${params.total}` : key) as never);

      await component.createPlan(5);

      expect(loader.message).toBe('2/2');
    });

    it('si falla la preparación cierra el cargando y no navega ni crea el plan', async () => {
      blockService.getPuzzlesForBlock.mockRejectedValue(new Error('sin puzzles'));

      await component.createPlan(5);

      expect(loader.dismiss).toHaveBeenCalledTimes(1);
      expect(planService.newPlan).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('tocar la cabecera de una tarjeta inicia esa rutina', async () => {
      const header = fixture.nativeElement.querySelector('.card [role="button"]') as HTMLElement;

      header.click();
      await fixture.whenStable();

      expect(blockService.generateBlocksForPlan).toHaveBeenCalledWith(`plan${TRAINING_PLAN_PRESETS[0].plan}`);
    });
  });

  it('al destruirse deja de escuchar el perfil', () => {
    const markForCheck = jest.spyOn(
      (component as unknown as { cdr: { markForCheck: () => void } }).cdr,
      'markForCheck',
    );
    fixture.destroy();

    profile$.next({ uid: 'u2' } as Profile);

    expect(markForCheck).not.toHaveBeenCalled();
  });
});
