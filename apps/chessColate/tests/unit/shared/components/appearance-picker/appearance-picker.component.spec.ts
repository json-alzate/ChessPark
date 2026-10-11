// El servicio real y la librería del tablero arrastran cm-chessboard, que Jest no sabe
// cargar. El selector solo necesita las listas de opciones y un tablero de muestra.
jest.mock('@services/app/appearance.service', () => ({ AppearanceService: class AppearanceService {} }));
jest.mock('@chesspark/board', () => {
  const { Component, Input } = jest.requireActual('@angular/core');
  class FenBoardComponent {
    fen = '';
  }
  Component({ selector: 'lib-fen-board', standalone: true, template: '' })(FenBoardComponent);
  Input()(FenBoardComponent.prototype, 'fen');
  return {
    FenBoardComponent,
    PIECES_STYLE_OPTIONS: ['cburnett', 'fantasy', 'staunty'],
    BOARD_STYLE_OPTIONS: [
      { name: 'chessboard-js', light: '#f0d9b5', dark: '#b58863' },
      { name: 'green', light: '#e0ddcc', dark: '#4c946a' },
    ],
  };
});

import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { APP_THEMES, AppTheme, BoardStyle, PiecesStyle } from '@chesspark/models';

import { AppearanceService } from '@services/app/appearance.service';
import { AppearancePickerComponent } from '@shared/components/appearance-picker/appearance-picker.component';
import { provideTranslocoTesting } from '@tests/support/transloco-testing';

describe('AppearancePickerComponent', () => {
  let fixture: ComponentFixture<AppearancePickerComponent>;
  let component: AppearancePickerComponent;
  let appearance: {
    pieces: ReturnType<typeof signal<PiecesStyle>>;
    board: ReturnType<typeof signal<BoardStyle>>;
    theme: ReturnType<typeof signal<AppTheme>>;
    setPieces: jest.Mock;
    setBoard: jest.Mock;
    setTheme: jest.Mock;
  };
  let observers: { observe: jest.Mock; disconnect: jest.Mock }[];

  const root = () => fixture.nativeElement as HTMLElement;
  const pressed = (container: ParentNode = root()) =>
    Array.from(container.querySelectorAll('[aria-pressed="true"]')) as HTMLElement[];
  const tabs = () => Array.from(root().querySelectorAll('[role="tab"]')) as HTMLButtonElement[];

  function render(inputs: Record<string, unknown> = {}) {
    fixture = TestBed.createComponent(AppearancePickerComponent);
    component = fixture.componentInstance;
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    jest.useFakeTimers();
    observers = [];
    // jsdom no trae ResizeObserver; el selector lo usa para recentrar las tiras
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
      observe = jest.fn();
      disconnect = jest.fn();
      constructor() {
        observers.push(this);
      }
    };
    appearance = {
      pieces: signal<PiecesStyle>('cburnett'),
      board: signal<BoardStyle>('chessboard-js'),
      theme: signal<AppTheme>('halloween'),
      setPieces: jest.fn(),
      setBoard: jest.fn(),
      setTheme: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [AppearancePickerComponent],
      providers: [provideTranslocoTesting(), { provide: AppearanceService, useValue: appearance }],
    }).compileComponents();
  });

  afterEach(() => {
    jest.useRealTimers();
    delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
  });

  it('se crea con un tablero de muestra', () => {
    render();

    expect(component).toBeTruthy();
    expect(fixture.debugElement.query(By.css('lib-fen-board')).componentInstance.fen).toBe(component.previewFen);
  });

  describe('piezas', () => {
    it('ofrece un botón por estilo, con una muestra de su imagen', () => {
      render();
      const strip = root().querySelector('[aria-label^="APPEARANCE.piecesNames"]')!.parentElement!;

      const options = Array.from(strip.querySelectorAll('button')) as HTMLElement[];
      expect(options.map((b) => b.querySelector('img')?.getAttribute('src'))).toEqual([
        'assets/images/pieces/cburnett-wn.svg',
        'assets/images/pieces/fantasy-wn.svg',
        'assets/images/pieces/staunty-wn.svg',
      ]);
    });

    it('marca como elegido solo el estilo actual y escribe su nombre en el título', () => {
      appearance.pieces.set('fantasy');
      render();

      const selected = pressed().find((b) => b.getAttribute('aria-label')?.startsWith('APPEARANCE.piecesNames'));
      expect(selected?.getAttribute('aria-label')).toBe('APPEARANCE.piecesNames.fantasy');
      expect(root().textContent).toContain('APPEARANCE.piecesNames.fantasy');
    });

    it('al elegir uno lo manda al servicio de apariencia', () => {
      render();

      (root().querySelector('[aria-label="APPEARANCE.piecesNames.staunty"]') as HTMLButtonElement).click();

      expect(appearance.setPieces).toHaveBeenCalledWith('staunty');
    });

    it('si el servicio cambia el estilo desde fuera, la selección se mueve', () => {
      render();

      appearance.pieces.set('staunty');
      fixture.detectChanges();

      const selected = pressed().find((b) => b.getAttribute('aria-label')?.startsWith('APPEARANCE.piecesNames'));
      expect(selected?.getAttribute('aria-label')).toBe('APPEARANCE.piecesNames.staunty');
    });
  });

  describe('tablero', () => {
    it('muestra las casillas clara y oscura de cada estilo', () => {
      render();

      const green = root().querySelector('[aria-label="APPEARANCE.boardsNames.green"]') as HTMLElement;
      const squares = Array.from(green.querySelectorAll('span > span')) as HTMLElement[];
      expect(squares.map((s) => s.style.backgroundColor)).toEqual([
        'rgb(224, 221, 204)',
        'rgb(76, 148, 106)',
        'rgb(76, 148, 106)',
        'rgb(224, 221, 204)',
      ]);
    });

    it('al elegir uno lo manda al servicio', () => {
      render();

      (root().querySelector('[aria-label="APPEARANCE.boardsNames.green"]') as HTMLButtonElement).click();

      expect(appearance.setBoard).toHaveBeenCalledWith('green');
    });

    it('marca el estilo actual', () => {
      appearance.board.set('green');
      render();

      const selected = pressed().find((b) => b.getAttribute('aria-label')?.startsWith('APPEARANCE.boardsNames'));
      expect(selected?.getAttribute('aria-label')).toBe('APPEARANCE.boardsNames.green');
    });
  });

  describe('tema de la app', () => {
    it('por defecto ofrece todos los temas y marca el actual', () => {
      render();

      const themeButtons = Array.from(root().querySelectorAll('button[aria-label]')).filter((b) =>
        (APP_THEMES as readonly string[]).includes(b.getAttribute('aria-label') ?? ''),
      );
      expect(themeButtons.length).toBe(APP_THEMES.length);
      expect(pressed().map((b) => b.getAttribute('aria-label'))).toContain('halloween');
    });

    it('al elegir uno lo manda al servicio', () => {
      render();

      (root().querySelector('button[aria-label="nord"]') as HTMLButtonElement).click();

      expect(appearance.setTheme).toHaveBeenCalledWith('nord');
    });

    it('con showTheme=false no se ofrece (el onboarding solo cambia tablero y piezas)', () => {
      render({ showTheme: false });

      expect(root().querySelector('button[aria-label="nord"]')).toBeNull();
      expect(root().textContent).not.toContain('APPEARANCE.theme');
    });
  });

  describe('pestañas', () => {
    it('sin tabbed ni compact se muestran las tres tiras a la vez, sin pestañas', () => {
      render();

      expect(root().querySelector('[role="tablist"]')).toBeNull();
      expect(root().querySelectorAll('.hidden').length).toBe(0);
    });

    it('con tabbed hay tres pestañas y solo se ve la de piezas al inicio', () => {
      render({ tabbed: true });

      expect(tabs().map((t) => t.textContent?.trim())).toEqual(['APPEARANCE.pieces', 'APPEARANCE.board', 'APPEARANCE.themeTab']);
      expect(tabs()[0].getAttribute('aria-selected')).toBe('true');
      expect(root().querySelectorAll('.hidden').length).toBe(2);
    });

    it('al tocar una pestaña cambia la tira visible', () => {
      render({ tabbed: true });

      tabs()[1].click();
      fixture.detectChanges();

      expect(component.tab()).toBe('board');
      expect(tabs()[1].getAttribute('aria-selected')).toBe('true');
      expect(tabs()[0].getAttribute('aria-selected')).toBe('false');
      const hiddenHeadings = Array.from(root().querySelectorAll('.hidden h3')).map((h) => h.textContent);
      expect(hiddenHeadings.join()).not.toContain('APPEARANCE.board');
    });

    it('sin tema (showTheme=false) la pestaña de tema desaparece', () => {
      render({ tabbed: true, showTheme: false });

      expect(tabs().map((t) => t.textContent?.trim())).toEqual(['APPEARANCE.pieces', 'APPEARANCE.board']);
    });

    it('el modo compacto siempre usa pestañas y ocupa el alto disponible (clase "fill")', () => {
      render({ compact: true });

      expect(tabs().length).toBe(3);
      expect(root().classList).toContain('fill');
    });

    it('fuera del modo compacto el anfitrión no lleva la clase "fill"', () => {
      render();

      expect(root().classList).not.toContain('fill');
    });
  });

  it('observa el tamaño de las tiras para recentrar la elegida y deja de hacerlo al destruirse', () => {
    render();

    expect(observers.length).toBe(1);
    expect(observers[0].observe).toHaveBeenCalledTimes(3); // piezas, tablero y tema

    fixture.destroy();

    expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
  });
});
