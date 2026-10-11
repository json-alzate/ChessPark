// La librería del tablero arrastra cm-chessboard, que Jest no sabe cargar. Aquí no
// se dibuja ningún tablero: AppearanceService la importa solo por sus tipos.
jest.mock('@chesspark/board', () => ({
  BoardPuzzleComponent: class {},
  BoardPuzzleSolutionComponent: class {},
}));

import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';

import { ModalController } from '@ionic/angular/standalone';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { Block, PuzzleThemesGroup } from '@chesspark/models';
import { SecondsToMinutesSecondsPipe } from '@chesspark/common-utils';

import { AppService } from '@core/app/app.service';
import { AppearanceService } from '@core/app/appearance.service';
import { KingImagePipe } from '@shared/pipes/king-image.pipe';

import { BlockSettingsComponent } from '@features/training/components/block-settings/block-settings.component';

import { findButton, textOf, translocoModule } from '@tests/support/puzzles-pages';

function theme(value: string, nameEs: string, nameEn: string, img: string) {
  return { value, nameEs, nameEn, img, descriptionEs: '', descriptionEn: '', count: 1 };
}

const THEME_GROUPS = [
  {
    groupName: 'Tácticas',
    themes: [theme('fork', 'Horquilla', 'Fork', 'fork.svg'), theme('pin', 'Clavada', 'Pin', 'pin.svg')],
  },
] as unknown as PuzzleThemesGroup[];

describe('BlockSettingsComponent', () => {
  let fixture: ComponentFixture<BlockSettingsComponent>;
  let component: BlockSettingsComponent;
  let el: HTMLElement;
  let modalController: { dismiss: jest.Mock };
  let appService: {
    getThemesPuzzle: PuzzleThemesGroup[];
    getNameThemePuzzleByValue: jest.Mock;
    getThemePuzzleByValue: jest.Mock;
  };

  function render(): void {
    fixture = TestBed.createComponent(BlockSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }

  function submit(): void {
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  /** Bloque con el que se cerró el modal. */
  function submittedBlock(): Block {
    expect(modalController.dismiss).toHaveBeenCalledTimes(1);
    return modalController.dismiss.mock.calls[0][0] as Block;
  }

  beforeEach(async () => {
    modalController = { dismiss: jest.fn() };
    appService = {
      getThemesPuzzle: THEME_GROUPS,
      getNameThemePuzzleByValue: jest.fn((v: string) => (v === 'fork' ? 'Horquilla' : '')),
      getThemePuzzleByValue: jest.fn((v: string) =>
        v === 'fork' ? { value: 'fork', img: 'fork.svg' } : undefined
      ),
    };

    await TestBed.configureTestingModule({
      imports: [BlockSettingsComponent, translocoModule()],
      providers: [
        { provide: ModalController, useValue: modalController },
        { provide: AppService, useValue: appService },
        { provide: AppearanceService, useValue: { pieces: () => 'cburnett' } },
      ],
    })
      .overrideComponent(BlockSettingsComponent, {
        set: {
          imports: [
            KingImagePipe,
            CommonModule,
            ReactiveFormsModule,
            TranslocoPipe,
            SecondsToMinutesSecondsPipe,
          ],
          schemas: [CUSTOM_ELEMENTS_SCHEMA],
        },
      })
      .compileComponents();
  });

  describe('bloque que entrega al pulsar Agregar', () => {
    it('con los valores por defecto entrega un bloque de 5 minutos, tema aleatorio, color aleatorio y dificultad automática', () => {
      render();

      submit();

      const block = submittedBlock();
      expect(block).toEqual(
        expect.objectContaining({
          time: 300,
          puzzlesCount: 0,
          theme: 'all',
          color: 'random',
          elo: 0,
          showPuzzleSolution: true,
          streamSolution: false,
          nextPuzzleImmediately: true,
          goshPuzzle: false,
          puzzlesPlayed: [],
          puzzleTimes: { total: 60, warningOn: 30, dangerOn: 15 },
        })
      );
      // Sin dificultad propia no viaja el rango de elo.
      expect(block).not.toHaveProperty('eloMin');
      expect(block).not.toHaveProperty('eloMax');
    });

    it('el tiempo en 0 (sin límite) se entrega como -1', () => {
      render();
      component.form.get('time')?.setValue(0);

      submit();

      expect(submittedBlock().time).toBe(-1);
    });

    it('el tiempo por ejercicio fija los umbrales de aviso (mitad) y peligro (cuarto)', () => {
      render();
      component.form.get('puzzleTime')?.setValue(120);

      submit();

      expect(submittedBlock().puzzleTimes).toEqual({ total: 120, warningOn: 60, dangerOn: 30 });
    });

    it('con "elo propio" activo entrega el rango y el elo medio', () => {
      render();
      component.useCustomElo = true;
      component.form.patchValue({ eloMin: 1000, eloMax: 1400 });

      submit();

      expect(submittedBlock()).toEqual(
        expect.objectContaining({ elo: 1200, eloMin: 1000, eloMax: 1400 })
      );
    });

    it('el color elegido con los botones viaja en el bloque', () => {
      render();

      findButton(el, 'NEW_BLOCK.color.black')?.click();
      fixture.detectChanges();
      expect(findButton(el, 'NEW_BLOCK.color.black')?.className).toContain('btn-primary');
      expect(findButton(el, 'NEW_BLOCK.color.random')?.className).toContain('btn-outline');

      submit();

      expect(submittedBlock().color).toBe('black');
    });

    it('el tema elegido en la lista viaja en el bloque', () => {
      render();
      const label = Array.from(el.querySelectorAll('label')).find((l) =>
        textOf(l).includes('Horquilla')
      );
      const fork = label?.querySelector('input[type="radio"]') as HTMLInputElement;

      fork.click();
      fork.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      submit();

      expect(submittedBlock().theme).toBe('fork');
    });

    it('no entrega nada si el formulario es inválido y el botón Agregar queda deshabilitado', () => {
      render();
      component.form.get('time')?.setValue(null);
      fixture.detectChanges();

      submit();

      expect(modalController.dismiss).not.toHaveBeenCalled();
      const addButton = findButton(el, 'NEW_BLOCK.actions.add') as HTMLButtonElement;
      expect(addButton.disabled).toBe(true);
    });

    it('cancela el envío por defecto del navegador', () => {
      render();
      const event = new Event('submit', { cancelable: true });

      component.onSubmit(event);

      expect(event.defaultPrevented).toBe(true);
    });
  });

  describe('cerrar', () => {
    it('la X cierra el modal sin entregar bloque', () => {
      render();

      el.querySelector<HTMLButtonElement>('.btn-circle')?.click();

      expect(modalController.dismiss).toHaveBeenCalledWith();
    });
  });

  describe('reglas entre opciones', () => {
    it('activar "mostrar solución" apaga "reproducir solución" y al revés', () => {
      render();
      const form = component.form;
      expect(form.get('showPuzzleSolution')?.value).toBe(true);

      form.get('streamSolution')?.setValue(true);
      expect(form.get('showPuzzleSolution')?.value).toBe(false);
      expect(form.get('streamSolution')?.value).toBe(true);

      form.get('showPuzzleSolution')?.setValue(true);
      expect(form.get('streamSolution')?.value).toBe(false);
      expect(form.get('showPuzzleSolution')?.value).toBe(true);
    });

    it('apagar una de las dos soluciones no enciende la otra', () => {
      render();

      component.form.get('showPuzzleSolution')?.setValue(false);

      expect(component.form.get('streamSolution')?.value).toBe(false);
    });

    it('el modo a ciegas habilita su tiempo visible; al apagarlo vuelve a 30 y se deshabilita', () => {
      render();
      const blindTime = component.form.get('goshPuzzleTime');
      expect(blindTime?.disabled).toBe(true);
      expect(el.querySelector('input[formcontrolname="goshPuzzleTime"]')).toBeNull();

      component.form.get('goshPuzzle')?.setValue(true);
      fixture.detectChanges();
      expect(blindTime?.enabled).toBe(true);
      expect(el.querySelector('input[formcontrolname="goshPuzzleTime"]')).not.toBeNull();

      blindTime?.setValue(90);
      component.form.get('goshPuzzle')?.setValue(false);
      fixture.detectChanges();

      expect(blindTime?.disabled).toBe(true);
      expect(blindTime?.value).toBe(30);
      expect(el.querySelector('input[formcontrolname="goshPuzzleTime"]')).toBeNull();
    });

    it('el modo a ciegas con tiempo propio lo entrega en el bloque', () => {
      render();
      component.form.get('goshPuzzle')?.setValue(true);
      component.form.get('goshPuzzleTime')?.setValue(45);

      submit();

      expect(submittedBlock()).toEqual(
        expect.objectContaining({ goshPuzzle: true, goshPuzzleTime: 45 })
      );
    });

    it('si el elo mínimo se acerca al máximo a menos de 100, el máximo sube para mantener la distancia', () => {
      render();
      component.form.patchValue({ eloMin: 1200, eloMax: 1800 });

      component.form.get('eloMin')?.setValue(1750);

      expect(component.form.get('eloMin')?.value).toBe(1750);
      expect(component.form.get('eloMax')?.value).toBe(1850);
    });

    it('el elo mínimo en el tope (2800) arrastra al mínimo hacia abajo para conservar 100 de rango', () => {
      render();

      component.form.get('eloMin')?.setValue(2800);

      expect(component.form.get('eloMax')?.value).toBe(2800);
      expect(component.form.get('eloMin')?.value).toBe(2700);
    });

    it('si el elo máximo baja a menos de 100 del mínimo, el mínimo baja con él', () => {
      render();
      component.form.patchValue({ eloMin: 1200, eloMax: 1800 });

      component.form.get('eloMax')?.setValue(1250);

      expect(component.form.get('eloMax')?.value).toBe(1250);
      expect(component.form.get('eloMin')?.value).toBe(1150);
    });

    it('el elo máximo en el piso (400) sube el máximo a 500 y deja el mínimo en 400', () => {
      render();

      component.form.get('eloMax')?.setValue(400);

      expect(component.form.get('eloMin')?.value).toBe(400);
      expect(component.form.get('eloMax')?.value).toBe(500);
    });

    it('un rango que ya respeta 100 de distancia no se toca', () => {
      render();

      component.form.get('eloMin')?.setValue(1000);

      expect(component.form.get('eloMin')?.value).toBe(1000);
      expect(component.form.get('eloMax')?.value).toBe(1800);
    });
  });

  describe('lo que se ve', () => {
    it('el resumen de duración muestra el tiempo, la cantidad o ambos con "o"', () => {
      render();
      const summary = () => textOf(el.querySelector('summary'));
      expect(summary()).toContain('NEW_BLOCK.form.duration');
      expect(summary()).toContain('05:00');

      component.form.patchValue({ time: 120, puzzlesCount: 9 });
      fixture.detectChanges();
      expect(summary()).toContain('02:00 NEW_BLOCK.form.or 9 NEW_BLOCK.fields.puzzles');

      component.form.patchValue({ time: 0, puzzlesCount: 9 });
      fixture.detectChanges();
      expect(summary()).toContain('9 NEW_BLOCK.fields.puzzles');
      expect(summary()).not.toContain('NEW_BLOCK.form.or');

      component.form.patchValue({ time: 0, puzzlesCount: 0 });
      fixture.detectChanges();
      expect(el.querySelector('summary ion-icon[name="infinite-outline"]')).not.toBeNull();
    });

    it('el resumen de dificultad dice "automática" hasta que se activa el elo propio, y entonces muestra el rango', () => {
      render();
      const summaries = () => Array.from(el.querySelectorAll('summary')).map((s) => textOf(s));
      expect(summaries().some((s) => s.includes('NEW_BLOCK.difficulty.auto'))).toBe(true);

      component.useCustomElo = true;
      component.form.patchValue({ eloMin: 1000, eloMax: 1500 });
      fixture.detectChanges();

      expect(summaries().some((s) => s.includes('ELO 1000 – 1500'))).toBe(true);
      expect(el.querySelectorAll('input[formcontrolname="eloMin"]')).toHaveLength(1);
    });

    it('el conmutador de elo propio muestra u oculta los selectores de rango', () => {
      render();
      expect(el.querySelector('input[formcontrolname="eloMin"]')).toBeNull();

      const toggle = el.querySelector<HTMLInputElement>(
        'input.toggle:not([formcontrolname])'
      ) as HTMLInputElement;
      toggle.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(component.useCustomElo).toBe(true);
      expect(el.querySelector('input[formcontrolname="eloMin"]')).not.toBeNull();
      expect(el.querySelector('input[formcontrolname="eloMax"]')).not.toBeNull();
    });

    it('lista los temas del catálogo por grupo, con el nombre en el idioma activo', () => {
      render();

      expect(textOf(el)).toContain('Tácticas');
      expect(textOf(el)).toContain('Horquilla');
      expect(textOf(el)).toContain('Clavada');
      expect(el.querySelectorAll('input[type="radio"][formcontrolname="theme"]')).toHaveLength(4);

      TestBed.inject(TranslocoService).setActiveLang('en');
      fixture.detectChanges();
      expect(component.lang).toBe('en');
      expect(textOf(el)).toContain('Fork');
      expect(textOf(el)).not.toContain('Horquilla');
    });

    it('el resumen del tema nombra el tema elegido y, con aleatorio o debilidades, usa su etiqueta', () => {
      render();
      const themeSummary = () => textOf(el.querySelectorAll('summary')[2]);
      expect(themeSummary()).toContain('NEW_BLOCK.theme.random');

      component.form.get('theme')?.setValue('weakness');
      fixture.detectChanges();
      expect(themeSummary()).toContain('NEW_BLOCK.theme.weakness');

      component.form.get('theme')?.setValue('fork');
      fixture.detectChanges();
      expect(themeSummary()).toContain('Horquilla');
      expect(el.querySelectorAll('summary')[2].querySelector('img')?.getAttribute('src')).toBe(
        'assets/images/puzzle-themes/fork.svg'
      );
    });

    it('al elegir un tema se pliega el desplegable de temas', () => {
      render();
      const details = el.querySelectorAll('details')[2] as HTMLDetailsElement;
      details.open = true;

      component.form.get('theme')?.setValue('fork');

      expect(details.open).toBe(false);
    });

    it('sin catálogo de temas solo quedan las opciones aleatorio y debilidades', () => {
      appService.getThemesPuzzle = undefined as unknown as PuzzleThemesGroup[];
      render();

      expect(el.querySelectorAll('input[type="radio"][formcontrolname="theme"]')).toHaveLength(2);
    });

    it('getThemeName y getThemeImg: aleatorio y debilidades no tienen nombre; sin imagen en catálogo se deduce del valor', () => {
      render();

      expect(component.getThemeName('all')).toBe('');
      expect(component.getThemeName('weakness')).toBe('');
      expect(component.getThemeName('fork')).toBe('Horquilla');
      expect(component.getThemeName('desconocido')).toBe('');
      expect(component.getThemeImg('fork')).toBe('fork.svg');
      expect(component.getThemeImg('mateIn2')).toBe('mateIn2.svg');
    });

    it('los botones de color muestran los reyes del set de piezas elegido', () => {
      render();

      const white = findButton(el, 'NEW_BLOCK.color.white')?.querySelector('img');
      const black = findButton(el, 'NEW_BLOCK.color.black')?.querySelector('img');
      expect(white?.getAttribute('src')).toBe('assets/images/pieces/cburnett-wk.svg');
      expect(black?.getAttribute('src')).toBe('assets/images/pieces/cburnett-bk.svg');
    });
  });
});
