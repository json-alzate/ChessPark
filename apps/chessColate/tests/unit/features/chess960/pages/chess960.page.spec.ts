// La librería del tablero arrastra cm-chessboard, que Jest no sabe cargar; aquí
// solo importa qué FEN recibe el tablero, así que se sustituye por un doble. Lo
// mismo con la barra de navegación (arrastra Firebase Auth).
jest.mock('@chesspark/board', () => {
  const { Component, Input } = jest.requireActual('@angular/core');
  class Chess960Board {
    boardConfig: unknown;
  }
  Component({ selector: 'lib-chess960-board', standalone: true, template: '' })(Chess960Board);
  Input()(Chess960Board.prototype, 'boardConfig');
  return { Chess960Board };
});
jest.mock('@shared/components/navbar/navbar.component', () => {
  const { Component } = jest.requireActual('@angular/core');
  class NavbarComponent {}
  Component({ selector: 'app-navbar', standalone: true, template: '' })(NavbarComponent);
  return { NavbarComponent };
});

import { HttpClientModule, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { By } from '@angular/platform-browser';

import { Chess960Page } from '@features/chess960/pages/chess960.page';
import { AnalyticsService } from '@core/analytics/analytics.service';
import { provideTranslocoTesting } from '@tests/support/transloco-testing';

const STANDARD_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const POSITIONS = [
  { id: 0, fen: 'bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w KQkq - 0 1' },
  { id: 518, fen: STANDARD_FEN },
  { id: 959, fen: 'rkrnnqbb/pppppppp/8/8/8/8/PPPPPPPP/RKRNNQBB w KQkq - 0 1' },
];

describe('Chess960Page', () => {
  let component: Chess960Page;
  let fixture: ComponentFixture<Chess960Page>;
  let http: HttpTestingController;
  let router: { navigate: jest.Mock };
  let analytics: { logEvent: jest.Mock };

  /** Responde la descarga del catálogo de posiciones. */
  function flushPositions(data = POSITIONS) {
    http.expectOne('assets/data/chess960.json').flush(data);
    fixture.detectChanges();
  }

  const boardFen = (): string | undefined =>
    fixture.debugElement.query(By.css('lib-chess960-board'))?.componentInstance.boardConfig?.position;

  beforeEach(async () => {
    router = { navigate: jest.fn() };
    analytics = { logEvent: jest.fn().mockResolvedValue(undefined) };

    await TestBed.configureTestingModule({
      imports: [Chess960Page],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslocoTesting(),
        { provide: Router, useValue: router },
        { provide: AnalyticsService, useValue: analytics },
      ],
    })
      // El módulo HTTP del componente traería su propio backend real
      .overrideComponent(Chess960Page, { remove: { imports: [HttpClientModule] } })
      .compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Chess960Page);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('se crea y mientras descarga las posiciones no pinta el tablero', () => {
    expect(component).toBeTruthy();
    expect(component.isLoading).toBe(true);
    expect(fixture.debugElement.query(By.css('lib-chess960-board'))).toBeNull();
    http.expectOne('assets/data/chess960.json');
  });

  it('al cargar las posiciones quita el spinner y muestra la posición estándar (518)', () => {
    flushPositions();

    expect(component.isLoading).toBe(false);
    expect(component.currentPositionId).toBe(518);
    expect(boardFen()).toBe(STANDARD_FEN);
  });

  it('si la descarga falla deja de cargar y conserva la posición por defecto', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    http.expectOne('assets/data/chess960.json').error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(component.isLoading).toBe(false);
    expect(component.positions).toEqual([]);
    expect(component.currentFen).toBe(STANDARD_FEN);
    consoleError.mockRestore();
  });

  it('cambiar el número de posición actualiza el tablero y manda analítica manual', () => {
    flushPositions();

    component.currentPositionId = 959;
    component.onIdChange();
    fixture.detectChanges();

    expect(boardFen()).toBe(POSITIONS[2].fen);
    expect(analytics.logEvent).toHaveBeenCalledWith('chess960_position_changed', {
      position_id: 959,
      source: 'manual',
    });
  });

  it('un número fuera de 0-959 se recorta al límite más cercano', () => {
    flushPositions();

    component.currentPositionId = 5000;
    component.onIdChange();
    expect(component.currentPositionId).toBe(959);

    component.currentPositionId = -3;
    component.onIdChange();
    expect(component.currentPositionId).toBe(0);
    expect(component.currentFen).toBe(POSITIONS[0].fen);
  });

  it('un decimal se trunca al entero y un campo vacío no carga ni registra nada', () => {
    flushPositions();
    analytics.logEvent.mockClear();

    component.currentPositionId = 1.5;
    component.onIdChange();
    expect(component.currentPositionId).toBe(1);

    component.currentPositionId = null as unknown as number;
    component.onIdChange();
    expect(component.currentPositionId).toBeNull();
    expect(analytics.logEvent).toHaveBeenCalledTimes(1);
  });

  it('una posición que no está en el catálogo no cambia el tablero', () => {
    flushPositions();

    component.loadPosition(300);

    expect(component.currentPositionId).toBe(300);
    expect(component.currentFen).toBe(STANDARD_FEN);
  });

  it('loadPosition ignora ids fuera de rango y no hace nada sin catálogo', () => {
    component.loadPosition(10); // aún sin catálogo
    expect(component.currentPositionId).toBe(518);

    flushPositions();
    component.loadPosition(960);
    component.loadPosition(-1);
    expect(component.currentPositionId).toBe(518);
  });

  it('aleatoria elige una posición del catálogo y manda analítica "random"', () => {
    flushPositions();
    jest.spyOn(Math, 'random').mockReturnValue(0.999999); // → id 959

    component.randomizePosition();
    fixture.detectChanges();

    expect(component.currentPositionId).toBe(959);
    expect(boardFen()).toBe(POSITIONS[2].fen);
    expect(analytics.logEvent).toHaveBeenCalledWith('chess960_position_changed', {
      position_id: 959,
      source: 'random',
    });
    jest.restoreAllMocks();
  });

  it('el enlace de inicio navega a /home', () => {
    component.goToHome();

    expect(router.navigate).toHaveBeenCalledWith(['/home']);
    http.expectOne('assets/data/chess960.json');
  });
});
