import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BoardSizeService } from '@core/app/board-size.service';
import { BoardResizeHandleComponent } from '@shared/components/board-resize-handle/board-resize-handle.component';
import { translocoParaPruebas } from '@tests/support/racha-ajustes-recordatorios';

/**
 * El asa de la esquina del tablero. jsdom no tiene maquetación, así que se
 * simula la de las pantallas con tablero: una columna centrada en la ventana
 * (tablero + hueco + panel de 360 px) cuyo ancho es el tamaño elegido. Con ella
 * el asa avanza solo la mitad que el tablero en horizontal, que es justo lo que
 * el componente tiene que compensar.
 */

const VENTANA_ANCHO = 1280;
const VENTANA_ALTO = 900;
const PANEL = 360;
const HUECO = 32;
const TOP = 80;
const KEY = 'chessColate_board_size';

describe('BoardResizeHandleComponent', () => {
  let fixture: ComponentFixture<BoardResizeHandleComponent>;
  let asa: BoardResizeHandleComponent;
  let service: BoardSizeService;

  /** Ancho de la columna: lo que eligió el usuario o el de la pantalla por defecto. */
  const ancho = () => service.size() ?? 640;
  const izquierda = () => (VENTANA_ANCHO - (ancho() + HUECO + PANEL)) / 2;
  const elemento = () => fixture.nativeElement as HTMLElement;
  const grip = () => elemento().querySelector('[data-testid=board-resize-handle]') as HTMLElement;

  /** Centro del asa según la maquetación simulada (esquina inferior derecha del tablero). */
  const centroDelAsa = () => ({ x: izquierda() + ancho(), y: TOP + ancho() });

  function simularMaquetacion() {
    jest.spyOn(elemento(), 'getBoundingClientRect').mockImplementation(
      () => ({ width: ancho(), height: ancho(), left: izquierda(), top: TOP, right: izquierda() + ancho(), bottom: TOP + ancho(), x: izquierda(), y: TOP }) as DOMRect
    );
    jest.spyOn(grip(), 'getBoundingClientRect').mockImplementation(() => {
      const c = centroDelAsa();
      return { width: 26, height: 26, left: c.x - 13, top: c.y - 13, right: c.x + 13, bottom: c.y + 13, x: c.x - 13, y: c.y - 13 } as DOMRect;
    });
  }

  function evento(tipo: string, x: number, y: number, boton = 0) {
    const e = new MouseEvent(tipo, { clientX: x, clientY: y, button: boton, bubbles: true, cancelable: true });
    Object.defineProperty(e, 'pointerId', { value: 1 });
    return e;
  }

  const pulsar = (x: number, y: number, boton = 0) => {
    grip().dispatchEvent(evento('pointerdown', x, y, boton));
    fixture.detectChanges();
  };
  const mover = (x: number, y: number) => grip().dispatchEvent(evento('pointermove', x, y));
  const soltar = () => {
    grip().dispatchEvent(evento('pointerup', 0, 0));
    fixture.detectChanges();
  };
  const tecla = (key: string) => {
    const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    grip().dispatchEvent(e);
    return e;
  };

  beforeEach(async () => {
    localStorage.clear();
    document.documentElement.style.removeProperty('--cc-board-size');
    document.body.classList.remove('cc-board-resizing');
    Object.defineProperty(window, 'innerHeight', { value: VENTANA_ALTO, configurable: true });

    await TestBed.configureTestingModule({
      imports: [BoardResizeHandleComponent, translocoParaPruebas()],
    }).compileComponents();

    fixture = TestBed.createComponent(BoardResizeHandleComponent);
    asa = fixture.componentInstance;
    service = TestBed.inject(BoardSizeService);
    fixture.detectChanges();
    simularMaquetacion();
    // jsdom no implementa la captura del puntero
    grip().setPointerCapture = jest.fn();
    grip().releasePointerCapture = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.documentElement.style.removeProperty('--cc-board-size');
    document.body.classList.remove('cc-board-resizing');
  });

  describe('accesibilidad', () => {
    it('es un deslizador con nombre, rango y valor', () => {
      grip().dispatchEvent(new Event('pointerenter'));
      fixture.detectChanges();

      expect(grip().getAttribute('role')).toBe('slider');
      expect(grip().getAttribute('tabindex')).toBe('0');
      expect(grip().getAttribute('aria-label')).toBe('APP.components.resizeBoard');
      expect(grip().getAttribute('aria-valuemin')).toBe('320');
      expect(grip().getAttribute('aria-valuemax')).toBe('750');
      expect(grip().getAttribute('aria-valuenow')).toBe('640');
    });

    it('explica cómo se usa (arrastrar y doble clic) en su ayuda', () => {
      expect(grip().getAttribute('title')).toBe('APP.components.resizeBoardHint');
    });

    it('el tope depende de lo que la pantalla aparta del alto de la ventana', () => {
      fixture.componentRef.setInput('reserve', 240);
      fixture.detectChanges();

      expect(asa.maxSize).toBe(660);
    });
  });

  describe('arrastrar', () => {
    it('agrandar con el asa agranda el tablero y la columna lo sigue', () => {
      const c = centroDelAsa();
      pulsar(c.x, c.y);
      mover(c.x + 30, c.y + 30);

      expect(service.size()).toBeGreaterThan(640);
    });

    it('encoger con el asa encoge el tablero', () => {
      const c = centroDelAsa();
      pulsar(c.x, c.y);
      mover(c.x - 40, c.y - 40);

      expect(service.size()).toBeLessThan(640);
    });

    it('el asa alcanza al puntero aunque la columna esté centrada (se mueve la mitad en horizontal)', () => {
      const inicio = centroDelAsa();
      pulsar(inicio.x, inicio.y);

      // Un arrastre largo en pasos, como el de una mano
      for (let i = 1; i <= 12; i++) {
        const objetivo = { x: inicio.x - i * 6, y: inicio.y - i * 12 };
        mover(objetivo.x, objetivo.y);
        const asaAhora = centroDelAsa();
        // Con un solo grado de libertad no se puede clavar los dos ejes, pero sí acercarse
        expect(Math.abs(asaAhora.y - objetivo.y)).toBeLessThan(40);
      }
      const fin = { x: inicio.x - 72, y: inicio.y - 144 };
      expect(Math.abs(centroDelAsa().y - fin.y)).toBeLessThan(3);
      expect(Math.abs(centroDelAsa().x - fin.x)).toBeLessThan(40);
    });

    it('al agarrar el asa por un lado no salta: mantiene la distancia al puntero', () => {
      const c = centroDelAsa();
      pulsar(c.x + 8, c.y + 8);
      mover(c.x + 8, c.y + 8); // sin moverse

      expect(service.size()).toBe(640);
    });

    it('no pasa del techo de la pantalla por mucho que se arrastre', () => {
      const c = centroDelAsa();
      pulsar(c.x, c.y);
      for (let i = 1; i <= 40; i++) {
        mover(c.x + i * 20, c.y + i * 20);
      }

      expect(service.size()).toBe(750);
    });

    it('no baja del mínimo por mucho que se arrastre', () => {
      const c = centroDelAsa();
      pulsar(c.x, c.y);
      for (let i = 1; i <= 40; i++) {
        mover(c.x - i * 20, c.y - i * 20);
      }

      expect(service.size()).toBe(320);
    });

    it('mientras se arrastra no escribe en el dispositivo y al soltar sí', () => {
      const c = centroDelAsa();
      pulsar(c.x, c.y);
      mover(c.x - 40, c.y - 40);
      expect(localStorage.getItem(KEY)).toBeNull();

      soltar();

      expect(localStorage.getItem(KEY)).toBe(String(service.size()));
    });

    it('marca el cuerpo mientras se arrastra para no seleccionar texto, y lo quita al soltar', () => {
      const c = centroDelAsa();
      pulsar(c.x, c.y);
      expect(document.body.classList).toContain('cc-board-resizing');
      expect(grip().classList).toContain('dragging');

      soltar();

      expect(document.body.classList).not.toContain('cc-board-resizing');
      expect(grip().classList).not.toContain('dragging');
    });

    it('captura el puntero para seguir el arrastre aunque salga del asa', () => {
      const c = centroDelAsa();
      pulsar(c.x, c.y);
      expect(grip().setPointerCapture).toHaveBeenCalledWith(1);

      soltar();
      expect(grip().releasePointerCapture).toHaveBeenCalledWith(1);
    });

    it('un movimiento sin haber pulsado no cambia nada', () => {
      const c = centroDelAsa();
      mover(c.x + 100, c.y + 100);

      expect(service.size()).toBeNull();
    });

    it('un botón que no es el principal no inicia el arrastre', () => {
      const c = centroDelAsa();
      pulsar(c.x, c.y, 2);
      mover(c.x + 100, c.y + 100);

      expect(service.size()).toBeNull();
      expect(document.body.classList).not.toContain('cc-board-resizing');
    });

    it('soltar sin haber arrastrado no escribe nada', () => {
      soltar();
      expect(localStorage.getItem(KEY)).toBeNull();
    });

    it('cancelar el gesto (pointercancel) lo cierra igual que soltar', () => {
      const c = centroDelAsa();
      pulsar(c.x, c.y);
      mover(c.x - 40, c.y - 40);

      grip().dispatchEvent(evento('pointercancel', 0, 0));

      expect(document.body.classList).not.toContain('cc-board-resizing');
      expect(localStorage.getItem(KEY)).not.toBeNull();
    });
  });

  describe('teclado', () => {
    it.each([['ArrowRight'], ['ArrowUp']])('%s agranda de 16 en 16 y lo guarda', (flecha) => {
      tecla(flecha);

      expect(service.size()).toBe(656);
      expect(localStorage.getItem(KEY)).toBe('656');
    });

    it.each([['ArrowLeft'], ['ArrowDown']])('%s encoge de 16 en 16', (flecha) => {
      tecla(flecha);
      expect(service.size()).toBe(624);
    });

    it('la flecha no desplaza la página', () => {
      expect(tecla('ArrowRight').defaultPrevented).toBe(true);
    });

    it('otras teclas no hacen nada', () => {
      const e = tecla('a');

      expect(e.defaultPrevented).toBe(false);
      expect(service.size()).toBeNull();
    });

    it('respeta el techo', () => {
      service.set(750, 750);
      tecla('ArrowRight');
      expect(service.size()).toBe(750);
    });
  });

  describe('doble clic', () => {
    it('vuelve al tamaño de siempre y borra lo guardado', () => {
      service.set(700);
      service.save();

      grip().dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

      expect(service.size()).toBeNull();
      expect(localStorage.getItem(KEY)).toBeNull();
      expect(document.documentElement.style.getPropertyValue('--cc-board-size')).toBe('');
    });
  });
});
