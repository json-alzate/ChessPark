// El tablero arrastra cm-chessboard, que Jest no sabe cargar: aquí no se dibuja
// ninguno, el modal de solución se sustituye por una clase vacía.
jest.mock('@chesspark/board', () => ({
  BoardPuzzleComponent: class {},
  BoardPuzzleSolutionComponent: class BoardPuzzleSolutionComponent {},
}));

import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { AlertController, IonContent, IonIcon, ModalController } from '@ionic/angular/standalone';
import { TranslocoPipe } from '@jsverse/transloco';

import { BoardPuzzleSolutionComponent } from '@chesspark/board';

import { AppService } from '@core/app/app.service';
import { WoodpeckerDashboardComponent } from '@features/woodpecker/components/woodpecker-dashboard/woodpecker-dashboard.component';
import { WoodpeckerPage } from '@features/woodpecker/pages/woodpecker/woodpecker.page';
import { WoodpeckerService } from '@features/woodpecker/services/woodpecker.service';
import { WoodpeckerPgnSetupInput, WoodpeckerSetupInput } from '@features/woodpecker/utils/woodpecker-config.util';
import {
  ejercicio,
  ejercicios,
  estadoConProgreso,
  resultado,
  vuelta,
} from '@tests/support/pajaro-carpintero';
import {
  controladorFalso,
  diferida,
  NavbarFalsa,
  superposicionFalsa,
  translocoParaPruebas,
} from '@tests/support/racha-ajustes-recordatorios';
import { CommonModule } from '@angular/common';

/** Configuración falsa: mismas entradas y salidas que la real. */
@Component({ selector: 'app-woodpecker-setup', standalone: true, template: '' })
class ConfiguracionFalsa {
  @Input() availableThemes: string[] = [];
  @Input() busy = false;
  @Input() replacesExisting = false;
  @Input() introOpen = true;
  @Output() create = new EventEmitter<WoodpeckerSetupInput>();
  @Output() createFromPgn = new EventEmitter<WoodpeckerPgnSetupInput>();
}

const ENTRADA: WoodpeckerSetupInput = {
  size: 100,
  eloMin: 1300,
  eloMax: 1700,
  themes: ['fork', 'pin'],
  cycles: 5,
  order: 'shuffle',
  pace: 'standard',
};

describe('WoodpeckerPage', () => {
  let fixture: ComponentFixture<WoodpeckerPage>;
  let page: WoodpeckerPage;

  const router = { navigate: jest.fn() };
  const woodpecker = {
    load: jest.fn(),
    getState: jest.fn(),
    createSet: jest.fn(),
    createSetFromPgn: jest.fn(),
    discard: jest.fn(),
    availableThemes: ['fork', 'pin', 'mateIn2'],
    isCompleted: false,
  };
  const app = { getNameThemePuzzleByValue: jest.fn() };
  const alert = superposicionFalsa();
  const modal = superposicionFalsa();
  const alertController = controladorFalso(alert);
  const modalController = controladorFalso(modal);

  const puzzles = ejercicios(4);
  const estadoSinEmpezar = () => estadoConProgreso(puzzles, []);

  const el = (id: string) =>
    fixture.nativeElement.querySelector(`[data-testid=${id}]`) as HTMLElement | null;

  function mostrar() {
    page.ionViewWillEnter();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    woodpecker.load.mockReturnValue(null);
    woodpecker.getState.mockReturnValue(null);
    woodpecker.isCompleted = false;
    app.getNameThemePuzzleByValue.mockImplementation((tema: string) => `Tema ${tema}`);

    await TestBed.configureTestingModule({
      imports: [WoodpeckerPage, translocoParaPruebas()],
      providers: [
        { provide: Router, useValue: router },
        { provide: WoodpeckerService, useValue: woodpecker },
        { provide: AppService, useValue: app },
        { provide: AlertController, useValue: alertController },
        { provide: ModalController, useValue: modalController },
      ],
    })
      .overrideComponent(WoodpeckerPage, {
        set: {
          imports: [
            CommonModule,
            TranslocoPipe,
            IonContent,
            IonIcon,
            NavbarFalsa,
            ConfiguracionFalsa,
            WoodpeckerDashboardComponent,
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(WoodpeckerPage);
    page = fixture.componentInstance;
  });

  describe('qué enseña', () => {
    it('sin set deja configurarlo', () => {
      mostrar();

      expect(page.view).toBe('setup');
      expect(fixture.nativeElement.querySelector('app-woodpecker-setup')).not.toBeNull();
    });

    it('con set enseña el panel con los nombres de sus temas', () => {
      woodpecker.load.mockReturnValue(estadoSinEmpezar());
      mostrar();

      expect(page.view).toBe('dashboard');
      expect(page.themeNames).toEqual(['Tema fork', 'Tema pin']);
      expect(fixture.nativeElement.querySelector('app-woodpecker-dashboard')).not.toBeNull();
    });

    it('relee lo guardado cada vez que entra', () => {
      mostrar();
      woodpecker.load.mockReturnValue(estadoSinEmpezar());
      mostrar();

      expect(woodpecker.load).toHaveBeenCalledTimes(2);
      expect(page.view).toBe('dashboard');
    });

    it('lista los ejercicios que se fallan en varias vueltas, nombrados por su motivo táctico', () => {
      const conTemas = [
        ejercicio('p1', { rating: 1388, themes: ['advantage', 'fork', 'short'] }),
        ...ejercicios(3, 'q'),
      ];
      const falla = (n: number) =>
        vuelta(n, ['p1', 'q1', 'q2', 'q3'], [
          resultado('p1', false),
          resultado('q1', true),
          resultado('q2', true),
          resultado('q3', true),
        ], { finishedAt: n });
      woodpecker.load.mockReturnValue(estadoConProgreso(conTemas, [falla(1), falla(2)]));
      mostrar();

      expect(page.problemItems).toEqual([
        { uidPuzzle: 'p1', failures: 2, rating: 1388, themes: 'Tema fork' },
      ]);
    });

    it('ignora un problemático cuyo ejercicio ya no está en el set', () => {
      const falla = (n: number) =>
        vuelta(n, ['fantasma'], [resultado('fantasma', false)], { finishedAt: n });
      woodpecker.load.mockReturnValue(estadoConProgreso(puzzles, [falla(1), falla(2)]));
      mostrar();

      expect(page.problemItems).toEqual([]);
    });

    it('mientras se arma el set, volver a la pantalla no lo tapa', () => {
      page.view = 'generating';
      mostrar();

      expect(page.view).toBe('generating');
      expect(woodpecker.load).not.toHaveBeenCalled();
    });
  });

  describe('crear el set', () => {
    beforeEach(() => mostrar());

    it('arma la configuración con lo elegido y los temas del catálogo', async () => {
      woodpecker.createSet.mockResolvedValue({ status: 'too-few', found: 1, required: 70 });

      await page.onCreate(ENTRADA);

      const config = woodpecker.createSet.mock.calls[0][0];
      expect(config).toMatchObject({
        targetCount: 100,
        minCount: 70,
        eloMin: 1300,
        eloMax: 1700,
        themes: ['fork', 'pin'],
        cycles: 5,
      });
    });

    it('con «todos» sortea entre los temas del catálogo', async () => {
      woodpecker.createSet.mockResolvedValue({ status: 'unavailable' });

      await page.onCreate({ ...ENTRADA, themes: 'all' });

      const { themes } = woodpecker.createSet.mock.calls[0][0];
      expect(themes.sort()).toEqual(['fork', 'mateIn2', 'pin']);
    });

    it('muestra el avance mientras baja los archivos', async () => {
      const pendiente = diferida<unknown>();
      woodpecker.createSet.mockImplementation(async (_config, avance) => {
        avance(2, 5);
        return pendiente.promesa;
      });

      const creacion = page.onCreate(ENTRADA);
      fixture.detectChanges();

      expect(page.view).toBe('generating');
      expect(page.generation).toEqual({ done: 2, total: 5 });
      expect(page.generationPercent).toBe(40);
      expect(el('generating')).not.toBeNull();

      pendiente.resolver({ status: 'unavailable' });
      await creacion;
    });

    it('si sale bien pasa al panel del set nuevo', async () => {
      woodpecker.createSet.mockImplementation(async () => {
        woodpecker.load.mockReturnValue(estadoSinEmpezar());
        return { status: 'ok', short: false, set: estadoSinEmpezar().set };
      });

      await page.onCreate(ENTRADA);

      expect(page.view).toBe('dashboard');
      expect(page.error).toBeNull();
      expect(page.shortNotice).toBeNull();
    });

    it('si salió con menos de lo pedido lo avisa', async () => {
      woodpecker.createSet.mockImplementation(async () => {
        woodpecker.load.mockReturnValue(estadoSinEmpezar());
        return { status: 'ok', short: true, set: estadoSinEmpezar().set };
      });

      await page.onCreate(ENTRADA);

      expect(page.shortNotice).toEqual({ requested: 100, actual: 4 });
    });

    it('el aviso se limpia al salir de la pantalla', async () => {
      woodpecker.createSet.mockImplementation(async () => {
        woodpecker.load.mockReturnValue(estadoSinEmpezar());
        return { status: 'ok', short: true, set: estadoSinEmpezar().set };
      });
      await page.onCreate(ENTRADA);

      page.ionViewWillLeave();

      expect(page.shortNotice).toBeNull();
    });

    it.each([
      [{ status: 'too-few', found: 12, required: 70 }, 'WOODPECKER.errors.tooFew', { found: 12, required: 70 }],
      [{ status: 'unavailable' }, 'WOODPECKER.errors.unavailable', undefined],
      [{ status: 'storage-full' }, 'WOODPECKER.errors.storageFull', undefined],
    ])('con %j explica qué pasó y deja volver a intentarlo', async (creacion, clave, params) => {
      woodpecker.createSet.mockResolvedValue(creacion);

      await page.onCreate(ENTRADA);
      fixture.detectChanges();

      expect(page.view).toBe('setup');
      expect(page.error).toEqual({ key: clave, params });
      expect(el('error')?.textContent).toContain(clave);
    });

    it('si falla con un set anterior, sigue ofreciendo reemplazarlo sin haberlo borrado', async () => {
      woodpecker.getState.mockReturnValue(estadoSinEmpezar());
      woodpecker.createSet.mockResolvedValue({ status: 'unavailable' });

      await page.onCreate(ENTRADA);

      expect(page.replacingSet).toBe(true);
      expect(woodpecker.discard).not.toHaveBeenCalled();
    });

    it('sin ningún tema válido no llega a pedir nada al catálogo', async () => {
      await page.onCreate({ ...ENTRADA, themes: ['inventado'] });

      expect(woodpecker.createSet).not.toHaveBeenCalled();
      expect(page.error).toEqual({ key: 'WOODPECKER.errors.noThemes' });
    });
  });

  describe('crear el set con un PGN propio', () => {
    const ENTRADA_PGN: WoodpeckerPgnSetupInput = {
      name: 'mis-tacticas.pgn',
      puzzles,
      cycles: 3,
      order: 'same',
      pace: 'relaxed',
    };

    beforeEach(() => mostrar());

    it('crea el set al momento y pasa al panel, sin pantalla de descarga', () => {
      woodpecker.createSetFromPgn.mockImplementation(() => {
        woodpecker.load.mockReturnValue(estadoSinEmpezar());
        return { status: 'ok', short: false, set: estadoSinEmpezar().set };
      });

      page.onCreateFromPgn(ENTRADA_PGN);

      expect(woodpecker.createSetFromPgn).toHaveBeenCalledWith(ENTRADA_PGN);
      expect(page.view).toBe('dashboard');
      expect(page.error).toBeNull();
      expect(page.shortNotice).toBeNull();
    });

    it('si no cabe en el dispositivo lo dice y sigue en la configuración', () => {
      woodpecker.createSetFromPgn.mockReturnValue({ status: 'storage-full' });

      page.onCreateFromPgn(ENTRADA_PGN);

      expect(page.view).toBe('setup');
      expect(page.error).toEqual({ key: 'WOODPECKER.errors.storageFull' });
    });

    it('si falla con un set anterior, sigue ofreciendo reemplazarlo', () => {
      woodpecker.getState.mockReturnValue(estadoSinEmpezar());
      woodpecker.createSetFromPgn.mockReturnValue({ status: 'storage-full' });

      page.onCreateFromPgn(ENTRADA_PGN);

      expect(page.replacingSet).toBe(true);
    });
  });

  describe('temas de un set propio', () => {
    it('los ejercicios sin tema se rotulan «Propio» y los temas libres salen tal cual', () => {
      const estado = estadoSinEmpezar();
      estado.set.config.themes = ['custom', 'fork', 'mi-tema'];
      app.getNameThemePuzzleByValue.mockImplementation((tema: string) => (tema === 'fork' ? 'Ataque doble' : ''));
      woodpecker.load.mockReturnValue(estado);

      mostrar();

      expect(page.themeNames).toEqual(['CUSTOM_PGN.themeCustom', 'Ataque doble', 'mi-tema']);
    });
  });

  describe('armar otro set', () => {
    it('desde un set terminado abre la configuración avisando de que lo sustituye', () => {
      woodpecker.load.mockReturnValue(estadoSinEmpezar());
      mostrar();

      page.startNewSet();
      fixture.detectChanges();

      expect(page.view).toBe('setup');
      expect(page.replacingSet).toBe(true);
      expect(el('cancel-new')).not.toBeNull();
    });

    it('cancelar vuelve al panel del set, que sigue intacto', () => {
      woodpecker.load.mockReturnValue(estadoSinEmpezar());
      mostrar();
      page.startNewSet();

      page.cancelNewSet();

      expect(page.view).toBe('dashboard');
      expect(page.replacingSet).toBe(false);
      expect(woodpecker.discard).not.toHaveBeenCalled();
    });
  });

  describe('abandonar', () => {
    beforeEach(() => {
      woodpecker.load.mockReturnValue(estadoSinEmpezar());
      mostrar();
    });

    it('pide confirmación antes de borrar nada', async () => {
      await page.confirmDiscard();

      expect(alert.present).toHaveBeenCalled();
      expect(woodpecker.discard).not.toHaveBeenCalled();
    });

    it('al confirmar borra el set y vuelve a la configuración', async () => {
      await page.confirmDiscard();
      const botones = alertController.create.mock.calls[0][0].buttons;
      woodpecker.load.mockReturnValue(null);

      botones.find((b: { role: string }) => b.role === 'confirm').handler();

      expect(woodpecker.discard).toHaveBeenCalledTimes(1);
      expect(page.view).toBe('setup');
    });

    it('cancelar no borra nada', async () => {
      await page.confirmDiscard();
      const botones = alertController.create.mock.calls[0][0].buttons;

      expect(botones.find((b: { role: string }) => b.role === 'cancel').handler).toBeUndefined();
      expect(woodpecker.discard).not.toHaveBeenCalled();
    });

    it('el mensaje cambia si el set ya estaba terminado', async () => {
      woodpecker.isCompleted = true;

      await page.confirmDiscard();

      expect(alertController.create.mock.calls[0][0].message).toBe(
        'WOODPECKER.dashboard.discardConfirm.messageCompleted'
      );
    });
  });

  describe('acciones del panel', () => {
    beforeEach(() => {
      woodpecker.load.mockReturnValue(estadoSinEmpezar());
      mostrar();
    });

    it('jugar lleva a la pantalla de la vuelta', () => {
      page.play();
      expect(router.navigate).toHaveBeenCalledWith(['/woodpecker/play']);
    });

    it('el breadcrumb lleva al inicio', () => {
      page.goToHome();
      expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('ver un ejercicio problemático abre su solución con los temas traducidos', async () => {
      await page.viewProblem('p2');

      expect(modalController.create).toHaveBeenCalledWith(
        expect.objectContaining({
          component: BoardPuzzleSolutionComponent,
          componentProps: {
            puzzle: puzzles[1],
            themesTranslated: ['Tema fork'],
          },
        })
      );
      expect(modal.present).toHaveBeenCalled();
    });

    it('un ejercicio que no está en el set no abre nada', async () => {
      await page.viewProblem('fantasma');
      expect(modalController.create).not.toHaveBeenCalled();
    });
  });
});
