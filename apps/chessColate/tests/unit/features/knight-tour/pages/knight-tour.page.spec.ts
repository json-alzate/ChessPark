// cm-chessboard no se puede cargar en Jest: el tablero se sustituye por un doble.
jest.mock('@chesspark/board', () =>
  jest.requireActual('@tests/support/analisis-juegos.tablero')
);

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular/standalone';

import { KnightTourPage } from '@app/features/knight-tour/pages/knight-tour.page';
import { NavbarComponent } from '@shared/components/navbar/navbar.component';
import { AnalyticsService } from '@services/analytics/analytics.service';

import {
  conModalFalso,
  StubNavbar,
  sustituirImports,
  textoDe,
  translocoTesting,
} from '@tests/support/analisis-juegos';

const TODAS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].flatMap((l) => ['1', '2', '3', '4', '5', '6', '7', '8'].map((n) => l + n));

describe('KnightTourPage', () => {
  let fixture: ComponentFixture<KnightTourPage>;
  let page: KnightTourPage;
  let router: { navigate: jest.Mock };
  let analytics: { logEvent: jest.Mock };
  let alerta: { present: jest.Mock };
  let alertController: { create: jest.Mock };

  const tablero = () => page.boardComponent as unknown as Record<string, jest.Mock>;
  const texto = () => textoDe(fixture.nativeElement);
  const botonCon = (fragmento: string) =>
    Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find((b) =>
      textoDe(b).includes(fragmento)
    );
  /** Pulsa una casilla del tablero. */
  const pulsar = (casilla: string) => page.onSquareSelected(casilla);

  /** Abre la pantalla y deja que el tablero termine de colocarse (reintentos de 150 ms + marca inicial de 100 ms). */
  function abrir(inicio: 'random' | 'a1' | 'h1' | 'a8' | 'h8' = 'a1') {
    fixture = TestBed.createComponent(KnightTourPage);
    page = fixture.componentInstance;
    page.startPosition = inicio;
    fixture.detectChanges();
    jest.advanceTimersByTime(300);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    jest.useFakeTimers({ now: new Date(2026, 5, 15, 12).getTime() });
    // La pantalla escribe en consola cada vez que mueve el caballo o marca una casilla
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    router = { navigate: jest.fn() };
    analytics = { logEvent: jest.fn().mockResolvedValue(undefined) };
    alerta = { present: jest.fn().mockResolvedValue(undefined) };
    alertController = { create: jest.fn().mockResolvedValue(alerta) };

    sustituirImports(KnightTourPage, [[NavbarComponent, StubNavbar]]);
    conModalFalso(KnightTourPage);
    await TestBed.configureTestingModule({
      imports: [KnightTourPage, translocoTesting()],
      providers: [
        { provide: Router, useValue: router },
        { provide: AnalyticsService, useValue: analytics },
        { provide: AlertController, useValue: alertController },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('geometría del tablero', () => {
    beforeEach(() => abrir());

    it.each([
      ['a1', [7, 0]],
      ['h1', [7, 7]],
      ['a8', [0, 0]],
      ['h8', [0, 7]],
      ['e4', [4, 4]],
    ])('la casilla %s está en la fila/columna %j', (casilla, coords) => {
      expect(page.squareToCoords(casilla)).toEqual(coords);
    });

    it.each(['', 'a', 'i1', 'a0', 'a9', 'zz', 'a11'])('la casilla inválida "%s" no tiene coordenadas', (casilla) => {
      expect(page.squareToCoords(casilla)).toBeNull();
    });

    it('las coordenadas vuelven a la misma casilla (ida y vuelta de las 64)', () => {
      for (const casilla of TODAS) {
        const [fila, col] = page.squareToCoords(casilla) as [number, number];
        expect(page.coordsToSquare(fila, col)).toBe(casilla);
      }
    });

    it('fuera del tablero no hay casilla', () => {
      expect(page.coordsToSquare(-1, 0)).toBe('');
      expect(page.coordsToSquare(0, 8)).toBe('');
    });

    it('reconoce los saltos del caballo y rechaza lo demás', () => {
      expect(page.isValidKnightMove('a1', 'b3')).toBe(true);
      expect(page.isValidKnightMove('a1', 'c2')).toBe(true);
      expect(page.isValidKnightMove('d4', 'f5')).toBe(true);
      expect(page.isValidKnightMove('a1', 'a2')).toBe(false);
      expect(page.isValidKnightMove('a1', 'b2')).toBe(false);
      expect(page.isValidKnightMove('a1', 'a1')).toBe(false);
      expect(page.isValidKnightMove('a1', 'zz')).toBe(false);
    });

    it('desde una esquina hay 2 movimientos y desde el centro 8', () => {
      page.visitedSquares = [];
      expect(page.getValidKnightMoves('a1').sort()).toEqual(['b3', 'c2']);
      expect(page.getValidKnightMoves('d4')).toHaveLength(8);
      expect(page.getValidKnightMoves('zz')).toEqual([]);
    });

    it('los movimientos válidos excluyen las casillas ya visitadas', () => {
      page.visitedSquares = ['b3'];
      expect(page.getValidKnightMoves('a1')).toEqual(['c2']);
    });

    it('crea el FEN con solo un caballo blanco en la casilla', () => {
      expect(page.createFenWithKnight('a1')).toBe('8/8/8/8/8/8/8/N7 w - - 0 1');
      expect(page.createFenWithKnight('h8')).toBe('7N/8/8/8/8/8/8/8 w - - 0 1');
      expect(page.createFenWithKnight('e4')).toBe('8/8/8/8/4N3/8/8/8 w - - 0 1');
    });

    it('una casilla inválida da un tablero vacío', () => {
      expect(page.createFenWithKnight('xx')).toBe('8/8/8/8/8/8/8/8 w - - 0 1');
    });

    it('formatea el tiempo como MM:SS', () => {
      expect(page.formatTime(0)).toBe('00:00');
      expect(page.formatTime(65)).toBe('01:05');
      expect(page.formatTime(3599)).toBe('59:59');
    });
  });

  describe('preparación', () => {
    it('coloca el caballo en la posición inicial, con coordenadas, cuando el tablero está listo', () => {
      abrir('h1');
      expect(page.currentPosition).toBe('h1');
      expect(tablero()['setPosition']).toHaveBeenCalledWith('8/8/8/8/8/8/8/7N w - - 0 1');
      expect(tablero()['toggleCoordinates']).toHaveBeenCalledWith(true);
    });

    it('marca la casilla inicial y la cuenta como visitada', () => {
      abrir('a1');
      expect(tablero()['addMarker']).toHaveBeenCalledWith(
        'a1',
        expect.objectContaining({ id: 'initial-a1', class: 'marker-square-green' })
      );
      expect(page.visitedSquares).toEqual(['a1']);
      expect(texto()).toContain('1');
    });

    it('con posición aleatoria elige una casilla del tablero', () => {
      abrir('random');
      expect(TODAS).toContain(page.currentPosition);
    });

    it('si el tablero tarda en estar listo, reintenta y avisa si nunca lo está', () => {
      const aviso = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      fixture = TestBed.createComponent(KnightTourPage);
      page = fixture.componentInstance;
      fixture.detectChanges();
      (page.boardComponent as unknown as { ready: boolean }).ready = false;
      jest.advanceTimersByTime(150 * 25);
      expect(aviso).toHaveBeenCalledWith('Board no está disponible después de varios intentos');
      expect(page.currentPosition).toBe('');
    });

    it('antes de jugar muestra el mensaje de listo y las instrucciones', () => {
      abrir();
      expect(texto()).toContain('KNIGHT_TOUR.readyToStart');
      expect(texto()).toContain('KNIGHT_TOUR.instructions');
      expect(botonCon('KNIGHT_TOUR.restart')).toBeUndefined();
    });
  });

  describe('jugar', () => {
    beforeEach(() => abrir('a1'));

    it('tocar el caballo muestra sus movimientos con puntos y vuelve a tocarlo los oculta', () => {
      tablero()['addMarker'].mockClear();
      pulsar('a1');
      const dots = tablero()['addMarker'].mock.calls.filter(([, m]) => m.slice === 'markerDot').map(([sq]) => sq);
      expect(dots.sort()).toEqual(['b3', 'c2']);
      expect(tablero()['addMarker']).toHaveBeenCalledWith('a1', expect.objectContaining({ slice: 'markerSquare' }));

      // los marcadores de movimientos se retiran al deseleccionar
      const punto = { slice: 'markerDot', class: 'marker-dot-green' };
      tablero()['getMarkers'].mockReturnValue([{ square: 'b3', type: punto }]);
      tablero()['removeMarkers'].mockClear();
      pulsar('a1');
      expect(tablero()['removeMarkers']).toHaveBeenCalledWith('b3', punto);
    });

    it('el primer salto válido inicia la partida y mueve el caballo', () => {
      pulsar('b3');
      expect(page.isPlaying).toBe(true);
      expect(page.currentPosition).toBe('b3');
      expect(page.visitedSquares).toEqual(['a1', 'b3']);
      expect(tablero()['setPosition']).toHaveBeenLastCalledWith(page.createFenWithKnight('b3'));
      expect(analytics.logEvent).toHaveBeenCalledWith('knight_tour_started', { start_position: 'a1' });
    });

    it('un movimiento que no es de caballo se ignora sin iniciar la partida', () => {
      pulsar('a2');
      expect(page.isPlaying).toBe(false);
      expect(page.currentPosition).toBe('a1');
      expect(page.visitedSquares).toEqual(['a1']);
    });

    it('no se puede volver a una casilla ya visitada', () => {
      pulsar('b3');
      pulsar('a1'); // desde b3 se puede ir a a1, pero ya se pasó por ahí
      expect(page.currentPosition).toBe('b3');
      expect(page.visitedSquares).toEqual(['a1', 'b3']);
    });

    it('marca de verde cada casilla visitada (tras una breve pausa)', () => {
      pulsar('b3');
      jest.advanceTimersByTime(150);
      expect(tablero()['addMarker']).toHaveBeenCalledWith(
        'b3',
        expect.objectContaining({ id: 'visited-b3', class: 'marker-square-green' })
      );
    });

    it('si se apagó "mostrar casillas visitadas" no las marca', () => {
      page.showVisited = false;
      tablero()['addMarker'].mockClear();
      pulsar('b3');
      jest.advanceTimersByTime(150);
      expect(tablero()['addMarker']).not.toHaveBeenCalled();
    });

    it('el cronómetro cuenta los segundos desde el primer movimiento', () => {
      pulsar('b3');
      jest.advanceTimersByTime(3000);
      fixture.detectChanges();
      expect(page.elapsedTime).toBe(3);
      expect(texto()).toContain('00:03');
    });

    it('muestra cuántas casillas se visitaron y habilita reiniciar mientras se juega', () => {
      pulsar('b3');
      pulsar('d4');
      fixture.detectChanges();
      expect(page.visitedSquares).toHaveLength(3);
      expect(texto()).toContain('3 / 64');
      expect(botonCon('KNIGHT_TOUR.restart')).toBeDefined();
      expect(texto()).not.toContain('KNIGHT_TOUR.readyToStart');
      expect(texto()).not.toContain('KNIGHT_TOUR.instructions');
    });

    it('seleccionar y luego tocar otra casilla que no es salto limpia la selección', () => {
      pulsar('a1');
      tablero()['removeMarkers'].mockClear();
      tablero()['getMarkers'].mockReturnValue([{ square: 'b3', type: { slice: 'markerDot' } }]);
      pulsar('h8');
      expect(tablero()['removeMarkers']).toHaveBeenCalled();
      expect(page.currentPosition).toBe('a1');
    });

    it('al cerrar la selección conserva los marcadores de casillas visitadas', () => {
      const visitada = { id: 'visited-b3', slice: 'markerSquare', class: 'marker-square-green' };
      const inicial = { id: 'initial-a1', slice: 'markerSquare', class: 'marker-square-green' };
      const seleccion = { slice: 'markerSquare', class: 'marker-square-green' };
      tablero()['getMarkers'].mockReturnValue([
        { square: 'b3', type: visitada },
        { square: 'a1', type: inicial },
        { square: 'd4', type: seleccion },
      ]);
      tablero()['removeMarkers'].mockClear();
      page.clearValidMoveMarkers();
      expect(tablero()['removeMarkers']).toHaveBeenCalledTimes(1);
      expect(tablero()['removeMarkers']).toHaveBeenCalledWith('d4', seleccion);
    });
  });

  describe('fin del juego', () => {
    beforeEach(() => abrir('a1'));

    it('sin movimientos disponibles pierde: avisa con una alerta y registra el resultado', () => {
      // al llegar a b3 todos sus destinos (a1, c1, d2, d4, a5, c5) ya están visitados
      page.visitedSquares = ['a1', 'c1', 'd2', 'd4', 'a5', 'c5'];
      pulsar('b3');
      expect(page.isGameOver).toBe(true);
      expect(page.isPlaying).toBe(false);
      expect(analytics.logEvent).toHaveBeenCalledWith('knight_tour_completed', {
        completed: false,
        time_seconds: 0,
        visited_count: 7,
        start_position: 'a1',
      });
      expect(alertController.create).toHaveBeenCalledWith(
        expect.objectContaining({ header: 'Game Over', buttons: expect.any(Array) })
      );
    });

    it('la alerta de game over permite reiniciar', async () => {
      page.visitedSquares = ['a1', 'c1', 'd2', 'd4', 'a5', 'c5'];
      pulsar('b3');
      await Promise.resolve();
      await Promise.resolve();
      const { buttons, message } = alertController.create.mock.calls[0][0];
      expect(message).toContain('7 / 64');
      buttons.find((b: { text: string }) => b.text === 'Reiniciar').handler();
      expect(page.isGameOver).toBe(false);
      expect(page.visitedSquares).toEqual([]);
    });

    it('con 64 casillas visitadas se completa el recorrido', () => {
      // todas menos la última (b3), que es un salto válido desde a1
      page.visitedSquares = TODAS.filter((c) => c !== 'b3');
      pulsar('b3');
      fixture.detectChanges();
      expect(page.visitedSquares).toHaveLength(64);
      expect(page.isCompleted).toBe(true);
      expect(page.isPlaying).toBe(false);
      expect(page.isGameOver).toBe(false);
      expect(analytics.logEvent).toHaveBeenCalledWith(
        'knight_tour_completed',
        expect.objectContaining({ completed: true, visited_count: 64 })
      );
      expect(texto()).toContain('KNIGHT_TOUR.congratulations');
      expect(alertController.create).not.toHaveBeenCalled();
    });

    it('al terminar ya no se admiten movimientos y se detiene el cronómetro', () => {
      page.visitedSquares = TODAS.filter((c) => c !== 'b3');
      pulsar('b3');
      const tiempo = page.elapsedTime;
      pulsar('d4');
      expect(page.currentPosition).toBe('b3');
      jest.advanceTimersByTime(5000);
      expect(page.elapsedTime).toBe(tiempo);
    });

    it('sin posición actual no hace nada', () => {
      page.currentPosition = '';
      pulsar('b3');
      expect(page.isPlaying).toBe(false);
    });
  });

  describe('reiniciar', () => {
    it('vuelve al estado inicial, limpia los marcadores y recoloca el caballo', () => {
      abrir('a1');
      pulsar('b3');
      jest.advanceTimersByTime(2000);
      fixture.detectChanges();
      tablero()['removeMarkers'].mockClear();
      tablero()['setPosition'].mockClear();

      botonCon('KNIGHT_TOUR.restart')?.click();
      jest.advanceTimersByTime(300);
      fixture.detectChanges();

      expect(page.isPlaying).toBe(false);
      expect(page.elapsedTime).toBe(0);
      expect(tablero()['removeMarkers']).toHaveBeenCalledWith();
      expect(tablero()['setPosition']).toHaveBeenCalled();
      expect(page.visitedSquares).toEqual([page.currentPosition]);
      expect(botonCon('KNIGHT_TOUR.restart')).toBeUndefined();
    });

    it('el cronómetro se detiene al reiniciar', () => {
      abrir('a1');
      pulsar('b3');
      jest.advanceTimersByTime(2000);
      page.resetGame();
      jest.advanceTimersByTime(5000);
      expect(page.elapsedTime).toBe(0);
    });
  });

  describe('ajustes', () => {
    beforeEach(() => abrir('a1'));

    it('cambiar la posición inicial antes de jugar recoloca el caballo y empieza de cero', () => {
      tablero()['setPosition'].mockClear();
      tablero()['removeMarkers'].mockClear();
      page.onStartPositionChange({ detail: { value: 'h8' } });
      jest.advanceTimersByTime(300);
      expect(page.startPosition).toBe('h8');
      expect(page.currentPosition).toBe('h8');
      expect(tablero()['removeMarkers']).toHaveBeenCalledWith();
      expect(tablero()['setPosition']).toHaveBeenCalledWith('7N/8/8/8/8/8/8/8 w - - 0 1');
      expect(page.visitedSquares).toEqual(['h8']);
    });

    it('durante la partida no se puede cambiar la posición inicial', () => {
      pulsar('b3');
      page.onStartPositionChange({ detail: { value: 'h8' } });
      expect(page.startPosition).toBe('a1');
      expect(page.currentPosition).toBe('b3');
    });

    it('apagar "mostrar visitadas" durante la partida quita las marcas (menos la del caballo)', () => {
      pulsar('b3');
      pulsar('d4');
      tablero()['removeMarkers'].mockClear();
      page.onShowVisitedChange({ target: { checked: false } });
      expect(page.showVisited).toBe(false);
      const quitadas = tablero()['removeMarkers'].mock.calls.map(([sq]) => sq).sort();
      expect(quitadas).toEqual(['a1', 'b3']);
    });

    it('encenderlo de nuevo vuelve a marcar las visitadas', () => {
      pulsar('b3');
      pulsar('d4');
      page.onShowVisitedChange({ target: { checked: false } });
      tablero()['addMarker'].mockClear();
      page.onShowVisitedChange({ target: { checked: true } });
      expect(page.showVisited).toBe(true);
      const marcadas = tablero()['addMarker'].mock.calls
        .filter(([, m]) => String(m.id).startsWith('visited-'))
        .map(([sq]) => sq)
        .sort();
      expect(marcadas).toEqual(['a1', 'b3']);
    });

    it('lee el valor también de un evento de Ionic (detail.checked)', () => {
      page.onShowVisitedChange({ detail: { checked: false } });
      expect(page.showVisited).toBe(false);
    });

    it('el ajuste de mostrar visitadas aparece en el menú de ajustes', () => {
      const casilla: HTMLInputElement = fixture.nativeElement.querySelector('input[type=checkbox]');
      expect(casilla.checked).toBe(true);
      casilla.checked = false;
      casilla.dispatchEvent(new Event('change'));
      expect(page.showVisited).toBe(false);
    });
  });

  describe('salida', () => {
    it('el enlace de inicio navega a /home', () => {
      abrir();
      fixture.nativeElement.querySelector('.breadcrumbs a').click();
      expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('al destruir la pantalla el cronómetro deja de contar', () => {
      abrir();
      pulsar('b3');
      jest.advanceTimersByTime(2000);
      fixture.destroy();
      const tiempo = page.elapsedTime;
      jest.advanceTimersByTime(5000);
      expect(page.elapsedTime).toBe(tiempo);
    });
  });
});
