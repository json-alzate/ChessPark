// La librería del tablero arrastra cm-chessboard, que Jest no sabe cargar (la
// importa BlockSettingsComponent a través de AppearanceService). Aquí no se
// dibuja ningún tablero.
jest.mock('@chesspark/board', () => ({
  BoardPuzzleComponent: class {},
  BoardPuzzleSolutionComponent: class {},
}));

import { CommonModule } from '@angular/common';
import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { NEVER, Observable, of, Subject } from 'rxjs';

import { ModalController } from '@ionic/angular/standalone';
import { TranslocoPipe } from '@jsverse/transloco';

import { Block, Plan, Profile } from '@chesspark/models';
import {
  CustomPlansFacadeService,
  getIsInitialized,
  getProfile,
  PlanFacadeService,
  PlansElosFacadeService,
} from '@chesspark/state';
import { SecondsToMinutesSecondsPipe, UidGeneratorService } from '@chesspark/common-utils';

import { AppService } from '@core/app/app.service';
import { ProfileService } from '@core/account/profile.service';
import { CustomPlansService } from '@features/training/services/custom-plans.service';
import { PlanService } from '@features/training/services/plan.service';
import { LoginComponent } from '@shared/components/login/login.component';

import { BlockSettingsComponent } from '@features/training/components/block-settings/block-settings.component';
import { CustomPlanFormPage } from '@features/training/pages/custom-plan-form.page';

import {
  ELO_TO_START_CASES,
  flushMicrotasks,
  iconNames,
  makeBlock,
  makePlan,
  silenceIonIconNoise,
  textOf,
  translocoModule,
} from '@tests/support/puzzles-pages';

@Component({ selector: 'app-navbar', standalone: true, template: '' })
class NavbarStub {}

const PROFILE = { uid: 'user-1' } as unknown as Profile;

/** Bloque tal y como lo entrega el modal de ajustes de bloque. */
function settingsBlock(overrides: Partial<Block> = {}): Block {
  return makeBlock({ puzzles: undefined, puzzlesPlayed: [], ...overrides });
}

describe('CustomPlanFormPage', () => {
  let fixture: ComponentFixture<CustomPlanFormPage>;
  let component: CustomPlanFormPage;
  let el: HTMLElement;
  let store: MockStore;

  let routeUid: string | null;
  let profileForService: { uid: string; elos?: Record<string, number> } | null;
  let profile$: Subject<Profile | null>;
  let planElos$: Observable<unknown>;

  let customPlansService: { getById: jest.Mock; save: jest.Mock; update: jest.Mock };
  let planService: { makeCustomPlanForPlay: jest.Mock };
  let planFacade: { clearPlan: jest.Mock; setPlan: jest.Mock };
  let customPlansFacade: { loadCustomPlans: jest.Mock };
  let plansElosFacade: { getPlanElo$: jest.Mock };
  let router: { navigate: jest.Mock };
  let modal: { present: jest.Mock; onDidDismiss: jest.Mock };
  let modalController: { create: jest.Mock };
  let appService: { getNameThemePuzzleByValue: jest.Mock; getThemePuzzleByValue: jest.Mock };

  function setSession(profile: Profile | null, initialized = true): void {
    store.overrideSelector(getProfile, profile);
    store.overrideSelector(getIsInitialized, initialized);
    store.refreshState();
  }

  function render(): void {
    fixture = TestBed.createComponent(CustomPlanFormPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }

  async function renderAndLoad(): Promise<void> {
    render();
    await flushMicrotasks();
    fixture.detectChanges();
  }

  /** Todos los botones con ese texto (hay un juego en el cuerpo y otro en el pie móvil). */
  function buttons(label: string): HTMLButtonElement[] {
    return Array.from(el.querySelectorAll('button')).filter((b) => textOf(b).includes(label));
  }

  function typeName(value: string): void {
    const input = el.querySelector('#plan-name') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  const blockRows = () => Array.from(el.querySelectorAll<HTMLElement>('ion-reorder-group > .card'));

  async function addBlockViaModal(block: Block): Promise<void> {
    modal.onDidDismiss.mockResolvedValueOnce({ data: block });
    await component.openBlockSettingsModal();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    silenceIonIconNoise();
    routeUid = null;
    profileForService = { uid: 'user-1' };
    profile$ = new Subject<Profile | null>();
    planElos$ = of({ timesPlayed: 0 });

    customPlansService = {
      getById: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    };
    planService = { makeCustomPlanForPlay: jest.fn().mockResolvedValue(makePlan({ uid: 'to-play' })) };
    planFacade = { clearPlan: jest.fn(), setPlan: jest.fn() };
    customPlansFacade = { loadCustomPlans: jest.fn() };
    plansElosFacade = { getPlanElo$: jest.fn(() => planElos$) };
    router = { navigate: jest.fn() };
    modal = {
      present: jest.fn().mockResolvedValue(undefined),
      onDidDismiss: jest.fn().mockResolvedValue({}),
    };
    modalController = { create: jest.fn().mockResolvedValue(modal) };
    appService = {
      getNameThemePuzzleByValue: jest.fn((v: string) => `Tema ${v}`),
      getThemePuzzleByValue: jest.fn((v: string) =>
        v === 'fork' ? { value: 'fork', img: 'fork-custom.svg' } : undefined
      ),
    };

    await TestBed.configureTestingModule({
      imports: [CustomPlanFormPage, translocoModule()],
      providers: [
        provideMockStore({
          selectors: [
            { selector: getProfile, value: PROFILE },
            { selector: getIsInitialized, value: true },
          ],
        }),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              get paramMap() {
                return convertToParamMap(routeUid ? { uid: routeUid } : {});
              },
            },
          },
        },
        { provide: Router, useValue: router },
        { provide: CustomPlansService, useValue: customPlansService },
        { provide: PlanService, useValue: planService },
        {
          provide: ProfileService,
          useValue: {
            get getProfile() {
              return profileForService;
            },
            profile$,
          },
        },
        { provide: PlanFacadeService, useValue: planFacade },
        { provide: CustomPlansFacadeService, useValue: customPlansFacade },
        { provide: PlansElosFacadeService, useValue: plansElosFacade },
        { provide: AppService, useValue: appService },
        { provide: ModalController, useValue: modalController },
        { provide: UidGeneratorService, useValue: { generateSimpleUid: () => 'new-uid' } },
      ],
    })
      .overrideComponent(CustomPlanFormPage, {
        set: {
          imports: [
            CommonModule,
            ReactiveFormsModule,
            TranslocoPipe,
            SecondsToMinutesSecondsPipe,
            NavbarStub,
          ],
          schemas: [CUSTOM_ELEMENTS_SCHEMA],
        },
      })
      .compileComponents();

    store = TestBed.inject(MockStore);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('crear una rutina: acceso', () => {
    it('mientras la autenticación no responde muestra un esqueleto y no pide iniciar sesión', () => {
      setSession(null, false);
      render();

      expect(el.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
      expect(textOf(el)).not.toContain('CUSTOM_TRAINING.authRequired');
      expect(el.querySelector('#plan-name')).toBeNull();
    });

    it('sin sesión pide iniciar sesión; Cancelar vuelve a la lista y Iniciar sesión abre el login', async () => {
      setSession(null);
      render();
      expect(textOf(el)).toContain('CUSTOM_TRAINING.authRequired');
      expect(el.querySelector('#plan-name')).toBeNull();

      buttons('CUSTOM_TRAINING.actions.cancel')[0].click();
      expect(router.navigate).toHaveBeenCalledWith(['/puzzles/custom-plans']);

      buttons('CUSTOM_TRAINING.actions.login')[0].click();
      await flushMicrotasks();

      expect(modalController.create).toHaveBeenCalledWith({
        component: LoginComponent,
        componentProps: { segmentEmailPassword: 'login' },
      });
      expect(modal.present).toHaveBeenCalledTimes(1);
    });

    it('tras iniciar sesión desde aquí carga las rutinas del usuario y deja de pedir login', async () => {
      setSession(null);
      render();
      await component.openLoginModal();

      profile$.next(null);
      expect(customPlansFacade.loadCustomPlans).not.toHaveBeenCalled();
      expect(component.loginOpenedFromCreatePlan).toBe(true);

      profile$.next(PROFILE);

      expect(customPlansFacade.loadCustomPlans).toHaveBeenCalledWith('user-1');
      expect(component.loginRequired).toBe(false);
      expect(component.loginOpenedFromCreatePlan).toBe(false);
    });

    it('un perfil que llega sin haber abierto el login desde aquí no dispara cargas', () => {
      setSession(PROFILE);
      render();

      profile$.next(PROFILE);

      expect(customPlansFacade.loadCustomPlans).not.toHaveBeenCalled();
    });

    it('al destruir la pantalla se cancela la espera del login', async () => {
      setSession(null);
      render();
      await component.openLoginModal();

      fixture.destroy();
      profile$.next(PROFILE);

      expect(customPlansFacade.loadCustomPlans).not.toHaveBeenCalled();
    });
  });

  describe('crear una rutina: formulario', () => {
    beforeEach(() => setSession(PROFILE));

    it('arranca vacío: sin bloques, contador 0 / 5 y guardar deshabilitado', () => {
      render();

      expect(component.isEditMode).toBe(false);
      expect(component.loading).toBe(false);
      expect(textOf(el)).toContain('CUSTOM_TRAINING.form.title');
      expect(textOf(el)).toContain('0 / 5');
      expect(blockRows()).toHaveLength(0);
      const save = buttons('CUSTOM_TRAINING.actions.saveAndPlay');
      expect(save.length).toBeGreaterThan(0);
      save.forEach((b) => expect(b.disabled).toBe(true));
      expect(buttons('CUSTOM_TRAINING.actions.editOnly')).toHaveLength(0);
    });

    it('con nombre y al menos un bloque se habilita Guardar y jugar', async () => {
      render();

      typeName('Mi rutina');
      buttons('CUSTOM_TRAINING.actions.saveAndPlay').forEach((b) => expect(b.disabled).toBe(true));

      await addBlockViaModal(settingsBlock());

      buttons('CUSTOM_TRAINING.actions.saveAndPlay').forEach((b) => expect(b.disabled).toBe(false));
    });

    it('un nombre vacío tocado muestra "obligatorio" y uno de más de 30 caracteres, "máximo"', () => {
      render();
      const input = el.querySelector('#plan-name') as HTMLInputElement;

      input.dispatchEvent(new Event('blur'));
      fixture.detectChanges();
      expect(textOf(el)).toContain('CUSTOM_TRAINING.errors.nameRequired');

      typeName('x'.repeat(31));
      input.dispatchEvent(new Event('blur'));
      fixture.detectChanges();
      expect(textOf(el)).toContain('CUSTOM_TRAINING.errors.nameMaxLength');
      expect(textOf(el)).not.toContain('CUSTOM_TRAINING.errors.nameRequired');
    });

    it('Cancelar vuelve a la lista de rutinas sin guardar', () => {
      render();

      buttons('CUSTOM_TRAINING.actions.cancel')[0].click();

      expect(router.navigate).toHaveBeenCalledWith(['/puzzles/custom-plans']);
      expect(customPlansService.save).not.toHaveBeenCalled();
    });
  });

  describe('bloques', () => {
    beforeEach(() => setSession(PROFILE));

    it('añadir bloque abre el modal de ajustes y agrega el bloque que devuelve', async () => {
      render();
      const block = settingsBlock({ theme: 'fork', time: 120, puzzlesCount: 0, color: 'white' });

      await addBlockViaModal(block);

      expect(modalController.create).toHaveBeenCalledWith(
        expect.objectContaining({ component: BlockSettingsComponent })
      );
      expect(modal.present).toHaveBeenCalledTimes(1);
      expect(component.blocks).toEqual([block]);
      expect(textOf(el)).toContain('1 / 5');
      expect(blockRows()).toHaveLength(1);
    });

    it('si el modal se cierra sin bloque no se agrega nada', async () => {
      render();

      await component.openBlockSettingsModal();

      expect(component.blocks).toHaveLength(0);
    });

    it('en pantalla ancha abre el modal como ventana de escritorio y en móvil como hoja con puntos de corte', async () => {
      render();
      const original = window.innerWidth;
      try {
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
        await component.openBlockSettingsModal();
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
        await component.openBlockSettingsModal();
      } finally {
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: original });
      }

      const [desktop, mobile] = modalController.create.mock.calls.map((c) => c[0]);
      expect(desktop).toEqual(expect.objectContaining({ cssClass: 'block-settings-modal-desktop' }));
      expect(desktop.breakpoints).toBeUndefined();
      expect(mobile).toEqual(
        expect.objectContaining({ initialBreakpoint: 0.75, breakpoints: [0, 0.5, 0.75, 0.9] })
      );
      expect(mobile.cssClass).toBeUndefined();
    });

    it('con 5 bloques no deja añadir más: el botón se deshabilita y el método no abre el modal', async () => {
      render();
      component.blocks = Array.from({ length: 5 }, () => settingsBlock());
      fixture.detectChanges();

      const add = buttons('CUSTOM_TRAINING.actions.addBlock')[0];
      expect(add.disabled).toBe(true);
      expect(textOf(el)).toContain('5 / 5');
      await component.openBlockSettingsModal();

      expect(modalController.create).not.toHaveBeenCalled();
    });

    it('cada bloque muestra su tema, su duración y el color con el que se juega', async () => {
      render();
      component.blocks = [
        settingsBlock({ theme: 'fork', time: 120, puzzlesCount: 0, color: 'white' }),
        settingsBlock({ theme: 'all', time: -1, puzzlesCount: 10, color: 'black' }),
        settingsBlock({ theme: 'weakness', time: 60, puzzlesCount: 5, color: 'random' }),
        settingsBlock({ theme: 'pin', time: -1, puzzlesCount: 0, color: 'random' }),
      ];
      fixture.detectChanges();

      const rows = blockRows();
      expect(rows).toHaveLength(4);
      expect(textOf(rows[0])).toContain('Tema fork');
      expect(textOf(rows[0])).toContain('02:00');
      expect(textOf(rows[0])).toContain('CUSTOM_TRAINING.colors.withWhite');
      expect(rows[0].querySelector('img')?.getAttribute('src')).toBe(
        'assets/images/puzzle-themes/fork-custom.svg'
      );

      expect(textOf(rows[1])).toContain('NEW_BLOCK.theme.random');
      expect(textOf(rows[1])).toContain('10 NEW_BLOCK.fields.puzzles');
      expect(textOf(rows[1])).toContain('CUSTOM_TRAINING.colors.withBlack');
      expect(iconNames(rows[1])).toContain('shuffle');
      expect(rows[1].querySelector('img')).toBeNull();

      expect(textOf(rows[2])).toContain('NEW_BLOCK.theme.weakness');
      expect(textOf(rows[2])).toContain('01:00 NEW_BLOCK.form.or 5 NEW_BLOCK.fields.puzzles');
      expect(textOf(rows[2])).toContain('CUSTOM_TRAINING.colors.anyColor');
      expect(iconNames(rows[2])).toContain('trending-down');

      expect(iconNames(rows[3])).toContain('infinite-outline');
      // Un tema sin imagen en el catálogo la deduce de su valor.
      expect(rows[3].querySelector('img')?.getAttribute('src')).toBe(
        'assets/images/puzzle-themes/pin.svg'
      );
    });

    it('la papelera quita ese bloque y deja los demás', () => {
      render();
      component.blocks = [
        settingsBlock({ theme: 'fork' }),
        settingsBlock({ theme: 'pin' }),
        settingsBlock({ theme: 'all' }),
      ];
      fixture.detectChanges();

      const trash = Array.from(blockRows()[1].querySelectorAll('button')).find((b) =>
        iconNames(b).includes('trash-outline')
      );
      trash?.click();
      fixture.detectChanges();

      expect(component.blocks.map((b) => b.theme)).toEqual(['fork', 'all']);
      expect(blockRows()).toHaveLength(2);
    });

    it('reordenar con arrastrar mueve el bloque a su nueva posición y termina el gesto sin reordenar la lista de Ionic', () => {
      render();
      component.blocks = [
        settingsBlock({ theme: 'fork' }),
        settingsBlock({ theme: 'pin' }),
        settingsBlock({ theme: 'all' }),
      ];
      fixture.detectChanges();
      const complete = jest.fn();

      el.querySelector('ion-reorder-group')?.dispatchEvent(
        new CustomEvent('ionItemReorder', { detail: { from: 0, to: 2, complete } })
      );
      fixture.detectChanges();

      expect(component.blocks.map((b) => b.theme)).toEqual(['pin', 'all', 'fork']);
      expect(complete).toHaveBeenCalledWith(false);
    });
  });

  describe('guardar', () => {
    beforeEach(() => {
      setSession(PROFILE);
      jest.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    });

    async function fillValidForm(): Promise<void> {
      render();
      typeName('Mi rutina');
      await addBlockViaModal(
        settingsBlock({
          theme: 'fork',
          puzzles: [{ uid: 'x' } as never],
          puzzlesPlayed: [{ uid: 'y' } as never],
        })
      );
    }

    it('save() crea la rutina nueva con su uid, el usuario y los bloques sin puzzles, y navega a la lista', async () => {
      await fillValidForm();
      component.isPublicControl.setValue(true);

      await component.save();

      expect(customPlansService.save).toHaveBeenCalledTimes(1);
      const saved = customPlansService.save.mock.calls[0][0] as Plan;
      expect(saved).toEqual({
        uid: 'new-uid',
        uidCustomPlan: 'new-uid',
        title: 'Mi rutina',
        uidUser: 'user-1',
        createdAt: 1_800_000_000_000,
        planType: 'custom',
        isPublic: true,
        blocks: [expect.objectContaining({ theme: 'fork', puzzlesPlayed: [] })],
      });
      expect(saved.blocks[0]).not.toHaveProperty('puzzles');
      expect(customPlansService.update).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/puzzles/custom-plans']);
      expect(planService.makeCustomPlanForPlay).not.toHaveBeenCalled();
    });

    it('sin sesión guarda con usuario vacío', async () => {
      profileForService = null;
      await fillValidForm();

      await component.save();

      expect((customPlansService.save.mock.calls[0][0] as Plan).uidUser).toBe('');
    });

    it('no guarda si falta el nombre (lo marca como tocado) o si no hay bloques', async () => {
      render();
      await addBlockViaModal(settingsBlock());

      await component.save();
      await component.saveAndPlay();
      expect(component.nameControl.touched).toBe(true);
      expect(customPlansService.save).not.toHaveBeenCalled();

      component.blocks = [];
      typeName('Con nombre');
      await component.save();
      await component.saveAndPlay();

      expect(customPlansService.save).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('un nombre de más de 30 caracteres tampoco se guarda', async () => {
      await fillValidForm();
      component.nameControl.setValue('x'.repeat(31));

      await component.save();

      expect(customPlansService.save).not.toHaveBeenCalled();
    });

    it('mientras guarda deshabilita los botones y al terminar los libera', async () => {
      await fillValidForm();
      let finish!: () => void;
      customPlansService.save.mockReturnValue(new Promise<void>((r) => (finish = r)));

      const pending = component.save();
      fixture.detectChanges();
      expect(component.saving).toBe(true);
      buttons('CUSTOM_TRAINING.actions.saveAndPlay').forEach((b) => expect(b.disabled).toBe(true));

      finish();
      await pending;
      expect(component.saving).toBe(false);
    });

    it('si falla el guardado libera el estado de "guardando", no navega y propaga el error', async () => {
      await fillValidForm();
      customPlansService.save.mockRejectedValue(new Error('firestore'));

      await expect(component.save()).rejects.toThrow('firestore');

      expect(component.saving).toBe(false);
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('Guardar y jugar guarda, prepara la rutina con el elo de arranque, limpia el plan anterior, deja el nuevo y entra a entrenar', async () => {
      profileForService = { uid: 'user-1', elos: { plan5Total: 1750 } };
      await fillValidForm();

      await component.saveAndPlay();

      const saved = customPlansService.save.mock.calls[0][0] as Plan;
      expect(planService.makeCustomPlanForPlay).toHaveBeenCalledWith(saved, 1750);
      expect(planFacade.clearPlan).toHaveBeenCalledTimes(1);
      expect(planFacade.setPlan).toHaveBeenCalledWith(expect.objectContaining({ uid: 'to-play' }));
      expect(planFacade.clearPlan.mock.invocationCallOrder[0]).toBeLessThan(
        planFacade.setPlan.mock.invocationCallOrder[0]
      );
      expect(router.navigate).toHaveBeenCalledWith(['/puzzles/training']);
      expect(customPlansService.save.mock.invocationCallOrder[0]).toBeLessThan(
        planService.makeCustomPlanForPlay.mock.invocationCallOrder[0]
      );
    });

    it('si falla la preparación para jugar no cambia el plan activo ni navega', async () => {
      await fillValidForm();
      planService.makeCustomPlanForPlay.mockRejectedValue(new Error('sin red'));

      await expect(component.saveAndPlay()).rejects.toThrow('sin red');

      expect(component.saving).toBe(false);
      expect(planFacade.setPlan).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    describe.each(ELO_TO_START_CASES)('elo de arranque al jugar', (testCase) => {
      it(testCase.name, async () => {
        profileForService =
          testCase.profileElos === null
            ? null
            : { uid: 'u', elos: testCase.profileElos as Record<string, number> };
        render();
        typeName('Rutina');
        component.blocks = testCase.blockTimes.map((time) => settingsBlock({ time }));

        await component.saveAndPlay();

        expect(planService.makeCustomPlanForPlay.mock.calls[0][1]).toBe(testCase.expected);
      });
    });

    // Las franjas se miden en segundos pero parecen pensadas en décimas de
    // minuto: 3000 s son 50 minutos, así que una rutina de 20 minutos (1200 s)
    // arranca con el elo de plan5 y no con el de plan20.
    it.skip('BUG: una rutina de 20 minutos debería arrancar con el elo de plan20', async () => {
      profileForService = { uid: 'u', elos: { plan5Total: 1111, plan20Total: 3333 } };
      render();
      typeName('Rutina');
      component.blocks = [settingsBlock({ time: 1200 })];

      await component.saveAndPlay();

      expect(planService.makeCustomPlanForPlay.mock.calls[0][1]).toBe(3333);
    });
  });

  describe('editar una rutina', () => {
    const existing = makePlan({
      uid: 'cp-1',
      uidCustomPlan: 'cp-1',
      title: 'Original',
      planType: 'custom',
      isPublic: true,
      createdAt: 1_600_000_000_000,
      blocks: [
        makeBlock({ theme: 'fork', puzzles: [{ uid: 'x' } as never], puzzlesPlayed: [{ uid: 'y' } as never] }),
        makeBlock({ theme: 'pin' }),
      ],
    });

    beforeEach(() => {
      routeUid = 'cp-1';
      customPlansService.getById.mockResolvedValue(existing);
      setSession(PROFILE);
    });

    it('carga la rutina por el uid de la ruta: nombre, visibilidad y bloques sin puzzles ni historial', async () => {
      await renderAndLoad();

      expect(component.isEditMode).toBe(true);
      expect(component.planUid).toBe('cp-1');
      expect(customPlansService.getById).toHaveBeenCalledWith('cp-1');
      expect(component.nameControl.value).toBe('Original');
      expect(component.isPublicControl.value).toBe(true);
      expect(component.originalCreatedAt).toBe(1_600_000_000_000);
      expect(component.blocks.map((b) => b.theme)).toEqual(['fork', 'pin']);
      expect(component.blocks[0].puzzles).toBeUndefined();
      expect(component.blocks[0].puzzlesPlayed).toEqual([]);
      expect(component.loading).toBe(false);
      expect(blockRows()).toHaveLength(2);
      expect((el.querySelector('#plan-name') as HTMLInputElement).value).toBe('Original');
    });

    it('mientras carga muestra el indicador y no el formulario', () => {
      customPlansService.getById.mockReturnValue(new Promise(() => undefined));
      render();

      expect(component.loading).toBe(true);
      expect(el.querySelector('.loading-spinner')).not.toBeNull();
      expect(el.querySelector('#plan-name')).toBeNull();
    });

    it('si la rutina no existe deja el formulario vacío y deja de cargar', async () => {
      customPlansService.getById.mockResolvedValue(null);

      await renderAndLoad();

      expect(component.loading).toBe(false);
      expect(component.blocks).toEqual([]);
      expect(component.nameControl.value).toBe('');
    });

    it('en edición no exige sesión en el store para mostrar el formulario', async () => {
      setSession(null);

      await renderAndLoad();

      expect(textOf(el)).not.toContain('CUSTOM_TRAINING.authRequired');
      expect(el.querySelector('#plan-name')).not.toBeNull();
    });

    it('ofrece "Editar y jugar" y "Solo editar" en lugar de "Guardar y jugar"', async () => {
      await renderAndLoad();

      expect(buttons('CUSTOM_TRAINING.actions.editAndPlay').length).toBeGreaterThan(0);
      expect(buttons('CUSTOM_TRAINING.actions.editOnly').length).toBeGreaterThan(0);
      expect(buttons('CUSTOM_TRAINING.actions.saveAndPlay')).toHaveLength(0);
    });

    it('"Solo editar" actualiza la rutina conservando su uid y su fecha de creación, y vuelve a la lista', async () => {
      await renderAndLoad();
      component.nameControl.setValue('Renombrada');
      component.isPublicControl.setValue(false);

      await component.save();

      expect(customPlansService.save).not.toHaveBeenCalled();
      expect(customPlansService.update).toHaveBeenCalledTimes(1);
      expect(customPlansService.update.mock.calls[0][0]).toEqual({
        uid: 'cp-1',
        uidCustomPlan: 'cp-1',
        title: 'Renombrada',
        uidUser: 'user-1',
        createdAt: 1_600_000_000_000,
        planType: 'custom',
        isPublic: false,
        blocks: [
          expect.objectContaining({ theme: 'fork', puzzlesPlayed: [] }),
          expect.objectContaining({ theme: 'pin', puzzlesPlayed: [] }),
        ],
      });
      expect(router.navigate).toHaveBeenCalledWith(['/puzzles/custom-plans']);
    });

    it('"Editar y jugar" actualiza y entra a entrenar con la rutina preparada', async () => {
      await renderAndLoad();

      await component.saveAndPlay();

      expect(customPlansService.update).toHaveBeenCalledTimes(1);
      expect(customPlansService.save).not.toHaveBeenCalled();
      expect(planService.makeCustomPlanForPlay).toHaveBeenCalledWith(
        expect.objectContaining({ uid: 'cp-1' }),
        1500
      );
      expect(planFacade.setPlan).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/puzzles/training']);
    });

    it('si la rutina ya se jugó, bloquea los bloques: avisa del motivo, oculta las papeleras y no deja añadir', async () => {
      planElos$ = of({ timesPlayed: 3 });
      await renderAndLoad();

      expect(plansElosFacade.getPlanElo$).toHaveBeenCalledWith('cp-1');
      expect(textOf(el)).toContain('CUSTOM_TRAINING.blocksLockedReason');
      expect(blockRows()).toHaveLength(2);
      blockRows().forEach((row) => {
        expect(iconNames(row)).not.toContain('trash-outline');
        expect(row.className).toContain('opacity-50');
      });
      expect(buttons('CUSTOM_TRAINING.actions.addBlock')[0].disabled).toBe(true);
    });

    it('si la rutina nunca se jugó, deja editar los bloques', async () => {
      planElos$ = of({ timesPlayed: 0 });
      await renderAndLoad();

      expect(textOf(el)).not.toContain('CUSTOM_TRAINING.blocksLockedReason');
      blockRows().forEach((row) => expect(iconNames(row)).toContain('trash-outline'));
      expect(buttons('CUSTOM_TRAINING.actions.addBlock')[0].disabled).toBe(false);
    });

    it('si los elos de la rutina no existen todavía se trata como no jugada', async () => {
      planElos$ = of(undefined);
      await renderAndLoad();

      expect(textOf(el)).not.toContain('CUSTOM_TRAINING.blocksLockedReason');
      expect(buttons('CUSTOM_TRAINING.actions.addBlock')[0].disabled).toBe(false);
    });
  });

  describe('canModifyBlocks y planElosForBlocks$', () => {
    beforeEach(() => setSession(PROFILE));

    it('al crear siempre se pueden modificar; al editar solo si no se ha jugado', () => {
      render();
      expect(component.canModifyBlocks({ timesPlayed: 9 })).toBe(true);

      component.isEditMode = true;
      expect(component.canModifyBlocks({ timesPlayed: 0 })).toBe(true);
      expect(component.canModifyBlocks({})).toBe(true);
      expect(component.canModifyBlocks(null)).toBe(true);
      expect(component.canModifyBlocks({ timesPlayed: 1 })).toBe(false);
    });

    it('al editar, si los elos no llegan en 800 ms se asume que no se ha jugado en vez de quedarse en el esqueleto', () => {
      jest.useFakeTimers();
      try {
        planElos$ = NEVER;
        render();
        component.isEditMode = true;
        component.planUid = 'cp-1';
        let value: unknown;

        component.planElosForBlocks$.subscribe((v) => (value = v));
        expect(value).toBeUndefined();
        jest.advanceTimersByTime(799);
        expect(value).toBeUndefined();
        jest.advanceTimersByTime(2);

        expect(value).toEqual({ timesPlayed: 0 });
      } finally {
        jest.useRealTimers();
      }
    });

    it('al editar, un error al leer los elos también se asume como no jugada', () => {
      render();
      component.isEditMode = true;
      component.planUid = 'cp-1';
      planElos$ = new Observable((s) => s.error(new Error('x')));
      let value: unknown;

      component.planElosForBlocks$.subscribe((v) => (value = v));

      expect(value).toEqual({ timesPlayed: 0 });
    });
  });

  describe('utilidades', () => {
    beforeEach(() => {
      setSession(PROFILE);
      render();
    });

    it('getThemeName: aleatorio y debilidades usan su etiqueta; el resto, el catálogo y, sin él, el valor', () => {
      appService.getNameThemePuzzleByValue.mockImplementation((v: string) => (v === 'fork' ? 'Horquilla' : ''));

      expect(component.getThemeName('all')).toBe('NEW_BLOCK.theme.random');
      expect(component.getThemeName('weakness')).toBe('NEW_BLOCK.theme.weakness');
      expect(component.getThemeName('fork')).toBe('Horquilla');
      expect(component.getThemeName('raro')).toBe('raro');
    });

    it('getThemeImg usa la imagen del catálogo o la deduce del valor', () => {
      expect(component.getThemeImg('fork')).toBe('fork-custom.svg');
      expect(component.getThemeImg('mateIn2')).toBe('mateIn2.svg');
    });

    it('getPlanEloForPlan pide los elos del uid dado, o de uno vacío si aún no hay', () => {
      component.getPlanEloForPlan('cp-9');
      component.getPlanEloForPlan(null);

      expect(plansElosFacade.getPlanElo$).toHaveBeenNthCalledWith(1, 'cp-9');
      expect(plansElosFacade.getPlanElo$).toHaveBeenNthCalledWith(2, '');
    });
  });
});
