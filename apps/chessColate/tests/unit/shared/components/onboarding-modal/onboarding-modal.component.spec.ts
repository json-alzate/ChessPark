// La librería del tablero arrastra cm-chessboard, que Jest no sabe cargar: el puzzle
// y el selector de apariencia se sustituyen por etiquetas vacías con la misma E/S.
jest.mock('@chesspark/board', () => {
  const { Component, Input, Output, EventEmitter } = jest.requireActual('@angular/core');
  class BoardPuzzleComponent {
    setPuzzle: unknown;
    puzzleCompleted = new EventEmitter();
    puzzleFailed = new EventEmitter();
  }
  Component({ selector: 'lib-board-puzzle', standalone: true, template: '' })(BoardPuzzleComponent);
  for (const input of ['setPuzzle', 'setForceStopTimer', 'showBoardControls', 'setShowMoveHint']) {
    Input()(BoardPuzzleComponent.prototype, input);
  }
  for (const output of ['puzzleCompleted', 'puzzleFailed']) {
    Output()(BoardPuzzleComponent.prototype, output);
  }
  return { BoardPuzzleComponent };
});
jest.mock('@shared/components/appearance-picker/appearance-picker.component', () => {
  const { Component, Input } = jest.requireActual('@angular/core');
  class AppearancePickerComponent {}
  Component({ selector: 'app-appearance-picker', standalone: true, template: '' })(AppearancePickerComponent);
  Input()(AppearancePickerComponent.prototype, 'compact');
  return { AppearancePickerComponent };
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { IonContent, IonIcon, ModalController } from '@ionic/angular/standalone';

import {
  ONBOARDING_SEEN_KEY,
  OnboardingModalComponent,
} from '@shared/components/onboarding-modal/onboarding-modal.component';
import { provideTranslocoTesting } from '@tests/support/transloco-testing';

describe('OnboardingModalComponent', () => {
  let fixture: ComponentFixture<OnboardingModalComponent>;
  let component: OnboardingModalComponent;
  let modalController: { dismiss: jest.Mock };
  let swiper: { activeIndex: number; slideTo: jest.Mock; slideNext: jest.Mock; slidePrev: jest.Mock };

  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => root().textContent as string;
  const button = (label: string) =>
    Array.from(root().querySelectorAll('button')).find((b) => b.textContent?.includes(label)) as HTMLButtonElement;
  const dots = () => Array.from(root().querySelectorAll('button[aria-label^="slide"]')) as HTMLButtonElement[];

  /** Simula lo que hace Swiper al terminar de cambiar de slide. */
  function swipeTo(index: number) {
    root()
      .querySelector('swiper-container')!
      .dispatchEvent(new CustomEvent('swiperslidechange', { detail: [{ activeIndex: index }] }));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    jest.useFakeTimers();
    localStorage.clear();
    modalController = { dismiss: jest.fn() };
    swiper = { activeIndex: 0, slideTo: jest.fn(), slideNext: jest.fn(), slidePrev: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [OnboardingModalComponent],
      providers: [provideTranslocoTesting(), { provide: ModalController, useValue: modalController }],
    })
      .overrideComponent(OnboardingModalComponent, { remove: { imports: [IonContent, IonIcon] } })
      .compileComponents();

    fixture = TestBed.createComponent(OnboardingModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    // El carrusel real es un custom element de Swiper; aquí se reemplaza por un doble.
    component.swiperRef = { nativeElement: { swiper } } as never;
  });

  afterEach(() => {
    jest.useRealTimers();
    localStorage.clear();
  });

  it('se crea en el primer slide, de 5, con su título', () => {
    expect(component).toBeTruthy();
    expect(component.slides.length).toBe(5);
    expect(component.currentSlide).toBe(0);
    expect(root().querySelectorAll('swiper-slide').length).toBe(5);
    expect(text()).toContain('ONBOARDING.slides.tactics.title');
  });

  describe('controles', () => {
    it('en el primer slide no hay botón de volver y el principal dice "siguiente"', () => {
      expect(button('ONBOARDING.back')).toBeUndefined();
      expect(button('ONBOARDING.next')).toBeDefined();
      expect(button('ONBOARDING.start')).toBeUndefined();
    });

    it('un punto por slide, y el actual es el ancho y de color primario', () => {
      expect(dots().length).toBe(5);
      expect(dots()[0].classList).toContain('bg-primary');
      expect(dots()[1].classList).toContain('bg-base-300');
    });

    it('al cambiar de slide se mueve el punto y aparece el botón de volver', () => {
      swipeTo(1);

      expect(component.currentSlide).toBe(1);
      expect(dots()[1].classList).toContain('bg-primary');
      expect(dots()[0].classList).not.toContain('bg-primary');
      expect(button('ONBOARDING.back')).toBeDefined();
    });

    it('"siguiente" avanza el carrusel, "volver" retrocede y un punto salta a su slide', () => {
      swipeTo(2);

      button('ONBOARDING.next').click();
      expect(swiper.slideNext).toHaveBeenCalledTimes(1);

      button('ONBOARDING.back').click();
      expect(swiper.slidePrev).toHaveBeenCalledTimes(1);

      dots()[4].click();
      expect(swiper.slideTo).toHaveBeenCalledWith(4);
    });

    it('en el último slide el botón principal dice "empezar" y termina el onboarding', () => {
      swipeTo(4);

      expect(component.isLastSlide).toBe(true);
      expect(button('ONBOARDING.next')).toBeUndefined();

      button('ONBOARDING.start').click();

      expect(swiper.slideNext).not.toHaveBeenCalled();
      expect(modalController.dismiss).toHaveBeenCalledTimes(1);
    });

    it('sin carrusel inicializado los controles no fallan', () => {
      component.swiperRef = undefined;

      expect(() => {
        component.next();
        component.prev();
        component.goTo(2);
      }).not.toThrow();
    });
  });

  describe('terminar', () => {
    it('"saltar" marca el onboarding como visto y cierra el modal', () => {
      button('ONBOARDING.skip').click();

      expect(localStorage.getItem(ONBOARDING_SEEN_KEY)).toBe('true');
      expect(modalController.dismiss).toHaveBeenCalledTimes(1);
    });

    it('si el almacenamiento no está disponible igual cierra', () => {
      jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('sin almacenamiento');
      });

      component.complete();

      expect(modalController.dismiss).toHaveBeenCalledTimes(1);
      jest.restoreAllMocks();
    });
  });

  describe('slide interactivo (mate en 2)', () => {
    it('el tablero no se carga hasta llegar a ese slide', () => {
      swipeTo(1);

      expect(component.matePuzzle).toBeUndefined();
      expect(fixture.debugElement.query(By.css('lib-board-puzzle'))).toBeNull();
    });

    it('al llegar al slide 3 carga el mate y pinta el tablero', () => {
      swipeTo(2);

      expect(component.matePuzzle?.uid).toBe('onboarding-mate-2');
      expect(fixture.debugElement.query(By.css('lib-board-puzzle'))).not.toBeNull();
    });

    it('al volver a pasar por el slide no reemplaza el puzzle ya cargado', () => {
      swipeTo(2);
      const first = component.matePuzzle;

      swipeTo(3);
      swipeTo(2);

      expect(component.matePuzzle).toBe(first);
    });

    it('al resolverlo cambia la descripción por el mensaje de celebración', () => {
      swipeTo(2);
      expect(text()).toContain('ONBOARDING.slides.solve.description');

      fixture.debugElement.query(By.css('lib-board-puzzle')).componentInstance.puzzleCompleted.emit();
      fixture.detectChanges();

      expect(component.puzzleSolved).toBe(true);
      expect(text()).toContain('ONBOARDING.slides.solve.solved');
      expect(text()).not.toContain('ONBOARDING.slides.solve.description');
    });

    it('si falla, reinicia el mate (copia nueva) tras 700 ms para reintentar', () => {
      swipeTo(2);
      const first = component.matePuzzle;

      fixture.debugElement.query(By.css('lib-board-puzzle')).componentInstance.puzzleFailed.emit();
      expect(component.matePuzzle).toBe(first);

      jest.advanceTimersByTime(700);

      expect(component.matePuzzle).not.toBe(first);
      expect(component.matePuzzle).toEqual(first);
    });

    it('un fallo posterior a resolverlo no reinicia el tablero', () => {
      swipeTo(2);
      component.onPuzzleSolved();
      const solved = component.matePuzzle;

      component.onPuzzleFailed();
      jest.advanceTimersByTime(2000);

      expect(component.matePuzzle).toBe(solved);
    });
  });

  it('el slide de apariencia monta el selector en modo compacto', () => {
    const picker = fixture.debugElement.query(By.css('app-appearance-picker'));

    expect(picker).not.toBeNull();
    expect(picker.componentInstance.compact).toBe(true);
  });
});
