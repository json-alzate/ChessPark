import { NgZone } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PackLabMapComponent } from '@features/chess-runner/components/pack-lab-map/pack-lab-map.component';
import { PackMap } from '@features/chess-runner/models/pack.model';
import { normalizeMap } from '@features/chess-runner/utils/pack-manifest.util';

import { provideTranslocoTesting } from '@tests/support/transloco-testing';
import { MAP_VACIO, MAP_ZONA } from '@tests/support/pack-lab';

describe('PackLabMapComponent', () => {
  let fixture: ComponentFixture<PackLabMapComponent>;
  let mapa: PackLabMapComponent;

  const todos = (testid: string) => Array.from(fixture.nativeElement.querySelectorAll(`[data-testid=${testid}]`)) as HTMLElement[];
  const uno = (testid: string) => fixture.nativeElement.querySelector(`[data-testid=${testid}]`) as HTMLElement | null;

  function pintar(map: PackMap, entradas: Partial<PackLabMapComponent> = {}) {
    fixture = TestBed.createComponent(PackLabMapComponent);
    mapa = fixture.componentInstance;
    fixture.componentRef.setInput('map', map);
    for (const [clave, valor] of Object.entries(entradas)) fixture.componentRef.setInput(clave, valor);
    fixture.detectChanges();
  }

  /** El ancho real del host (el componente lo mide con `getBoundingClientRect`, que en jsdom siempre da 0). */
  function anchoDelHost(width: number) {
    jest.spyOn(fixture.nativeElement as HTMLElement, 'getBoundingClientRect').mockReturnValue({ width } as DOMRect);
  }

  /** Repinta tras cambiar el estado interno (el componente es OnPush). */
  function repintar() {
    fixture.componentRef.changeDetectorRef.markForCheck();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PackLabMapComponent],
      providers: [provideTranslocoTesting()],
    }).compileComponents();
  });

  it('con el mapa vacío de hoy muestra «aún no hay zonas» y «aún no hay papel», sin romperse', () => {
    pintar(normalizeMap(MAP_VACIO));

    expect(uno('lab-zones-empty')?.textContent).toContain('PACK_LAB.map.empty');
    expect(uno('lab-paper-empty')).not.toBeNull();
    expect(todos('lab-zone')).toHaveLength(0);
  });

  it('con una zona elige la primera y pinta su escena, sus puntos y sus ambientes a escala', () => {
    pintar(normalizeMap(MAP_ZONA), { zoom: 2 });

    expect(todos('lab-zone').map((b) => b.textContent?.trim())).toEqual(['1']);
    expect(uno('lab-zone-stage')?.style.width).toBe('440px');
    expect(uno('lab-zone-scene')).not.toBeNull();
    expect(todos('lab-ambient')).toHaveLength(1);
    expect(todos('lab-ambient')[0].style.left).toBe('40px');
    // pattern y boss tienen sprite «open»; camp no, y sale el respaldo
    expect(todos('lab-node').map((n) => n.getAttribute('data-kind'))).toEqual(['pattern', 'boss']);
    expect(todos('lab-node-fallback').map((n) => n.getAttribute('data-kind'))).toEqual(['camp']);
  });

  it('en un móvil de 393 px baja el zoom del mapa al mayor entero que quepa a lo ancho (sin desplazar en horizontal)', () => {
    fixture = TestBed.createComponent(PackLabMapComponent);
    mapa = fixture.componentInstance;
    // ancho del componente en la página a 393 px (393 − márgenes); por dentro del borde quedan 357
    anchoDelHost(359);
    fixture.componentRef.setInput('map', normalizeMap(MAP_ZONA));
    fixture.componentRef.setInput('zoom', 2);
    fixture.detectChanges();

    expect(mapa.availableW).toBe(357);
    expect(uno('lab-zone-stage')?.style.width).toBe('220px');
    expect(uno('lab-paper-stage')?.style.width).toBe('220px');
    expect(todos('lab-ambient')[0].style.left).toBe('20px');
    expect(fixture.nativeElement.classList.contains('block')).toBe(true);
  });

  it('con un ancho fraccionario redondea hacia abajo: 441,6 px no dejan sitio para ×2 (440 + borde)', () => {
    fixture = TestBed.createComponent(PackLabMapComponent);
    mapa = fixture.componentInstance;
    // `clientWidth` daría 442 y quedarían 440 útiles: el escenario de 440 px no cabría en los 439,6 reales
    anchoDelHost(441.6);
    fixture.componentRef.setInput('map', normalizeMap(MAP_ZONA));
    fixture.componentRef.setInput('zoom', 2);
    fixture.detectChanges();

    expect(mapa.availableW).toBe(439);
    expect(uno('lab-zone-stage')?.style.width).toBe('220px');
  });

  describe('con ResizeObserver', () => {
    const globales = globalThis as unknown as Record<string, unknown>;
    const nombres = ['ResizeObserver', 'requestAnimationFrame', 'cancelAnimationFrame'];
    const antes = new Map<string, PropertyDescriptor | undefined>();
    let observadores: FakeResizeObserver[];
    let fotogramas: Map<number, FrameRequestCallback>;

    class FakeResizeObserver {
      readonly observe = jest.fn();
      readonly disconnect = jest.fn();
      constructor(readonly callback: () => void) {
        observadores.push(this);
      }
    }

    /**
     * Entrega una medida al callback del observador y devuelve los fotogramas que pidió (Angular también pide los suyos para
     * repintar, así que se cuentan solo los nuevos).
     */
    function entregar(ro: FakeResizeObserver): number[] {
      const antesDeEntregar = new Set(fotogramas.keys());
      ro.callback();
      return [...fotogramas.keys()].filter((id) => !antesDeEntregar.has(id));
    }

    /** Corre esos fotogramas (como hace el navegador antes de pintar). */
    function correr(ids: number[]) {
      for (const id of ids) {
        const cb = fotogramas.get(id);
        fotogramas.delete(id);
        cb?.(0);
      }
    }

    beforeEach(() => {
      for (const n of nombres) antes.set(n, Object.getOwnPropertyDescriptor(globalThis, n));
      observadores = [];
      fotogramas = new Map();
      let siguiente = 0;
      globales['ResizeObserver'] = FakeResizeObserver;
      globales['requestAnimationFrame'] = jest.fn((cb: FrameRequestCallback) => {
        fotogramas.set(++siguiente, cb);
        return siguiente;
      });
      globales['cancelAnimationFrame'] = jest.fn((id: number) => fotogramas.delete(id));
    });

    afterEach(() => {
      // deja los globales como estaban (jsdom no trae ResizeObserver: se borra en vez de quedar en `undefined`)
      for (const n of nombres) {
        const d = antes.get(n);
        if (d) Object.defineProperty(globalThis, n, d);
        else delete globales[n];
      }
    });

    it('observa el host y una medida nueva cambia la escala un fotograma después, fuera del callback', () => {
      pintar(normalizeMap(MAP_ZONA), { zoom: 2 });
      const ro = observadores[0];
      expect(ro.observe).toHaveBeenCalledWith(fixture.nativeElement);
      expect(uno('lab-zone-stage')?.style.width).toBe('440px');

      const zona = jest.spyOn(TestBed.inject(NgZone), 'run');
      anchoDelHost(359);
      const pedidos = [...entregar(ro), ...entregar(ro)];
      // dentro del callback no se mide ni se repinta: varias entregas se juntan en un solo fotograma
      expect(mapa.availableW).toBe(0);
      expect(pedidos).toHaveLength(1);

      correr(pedidos);
      expect(mapa.availableW).toBe(357);
      expect(zona).toHaveBeenCalled();
      repintar();
      expect(uno('lab-zone-stage')?.style.width).toBe('220px');
      expect(uno('lab-paper-stage')?.style.width).toBe('220px');

      // el mismo ancho otra vez (p. ej. solo cambió el alto) no entra en la zona de Angular
      zona.mockClear();
      correr(entregar(ro));
      expect(zona).not.toHaveBeenCalled();
    });

    it('al destruir se desconecta y cancela el fotograma pendiente', () => {
      pintar(normalizeMap(MAP_ZONA), { zoom: 2 });
      const ro = observadores[0];
      const [pendiente] = entregar(ro);
      expect(pendiente).toBeDefined();

      fixture.destroy();
      expect(ro.disconnect).toHaveBeenCalledTimes(1);
      expect(globales['cancelAnimationFrame']).toHaveBeenCalledWith(pendiente);
      expect(fotogramas.has(pendiente)).toBe(false);
    });

    it('sin requestAnimationFrame mide al momento', () => {
      delete globales['requestAnimationFrame'];
      delete globales['cancelAnimationFrame'];
      pintar(normalizeMap(MAP_ZONA), { zoom: 2 });

      anchoDelHost(359);
      observadores[0].callback();
      repintar();
      expect(uno('lab-zone-stage')?.style.width).toBe('220px');
      expect(() => fixture.destroy()).not.toThrow();
    });
  });

  it('el interruptor apaga y enciende las animaciones de ambiente', () => {
    pintar(normalizeMap(MAP_ZONA));

    uno('lab-ambient-toggle')?.dispatchEvent(new Event('change'));
    repintar();
    expect(todos('lab-ambient')).toHaveLength(0);

    uno('lab-ambient-toggle')?.dispatchEvent(new Event('change'));
    repintar();
    expect(todos('lab-ambient')).toHaveLength(1);
  });

  it('el estado de los puntos cambia el sprite (y el camp usa su «done» en las estrellas)', () => {
    pintar(normalizeMap(MAP_ZONA));

    const done2 = todos('lab-node-state').find((b) => b.textContent?.includes('done2'));
    done2?.click();
    repintar();

    const fondos = todos('lab-node').map((n) => `${n.getAttribute('data-kind')}:${n.style.backgroundImage}`);
    expect(fondos.some((f) => f.startsWith('pattern:') && f.includes('map-node-pattern-done2.png'))).toBe(true);
    expect(fondos.some((f) => f.startsWith('camp:') && f.includes('map-node-camp-done.png'))).toBe(true);
  });

  it('el deslizador rellena las galletas y mueve la huella', () => {
    pintar(normalizeMap(MAP_ZONA), { zoom: 1 });
    const galletas = () => todos('lab-cookie').map((c) => c.getAttribute('data-cookie'));

    expect(galletas()).toEqual(['cookie-board-empty', 'cookie-board-empty', 'cookie-board-empty']);
    // con progreso 0 la huella va en la ruta antes de la parada (29, 291), no encima de la cara del jefe (40, 280)
    expect(uno('lab-marker')?.style.left).toBe('23px');
    expect(uno('lab-marker')?.style.top).toBe('285px');
    const deslizador = uno('lab-progress') as HTMLInputElement;
    expect(deslizador.max).toBe('3');

    deslizador.value = '2';
    deslizador.dispatchEvent(new Event('input'));
    repintar();

    expect(galletas()).toEqual(['cookie-board', 'cookie-gold', 'cookie-board-empty']);
    // la huella (12×12) centrada en el 2.º checkpoint (60, 260)
    expect(uno('lab-marker')?.style.left).toBe('54px');
    expect(uno('lab-marker')?.style.top).toBe('254px');
  });

  it('los botones de estado son táctiles (btn-sm) y no van en un join que se parta', () => {
    pintar(normalizeMap(MAP_ZONA));

    const estados = todos('lab-node-state');
    expect(estados).toHaveLength(6);
    expect(estados.every((b) => b.classList.contains('btn-sm') && !b.classList.contains('join-item'))).toBe(true);
    expect(todos('lab-variant').every((b) => b.classList.contains('btn-sm'))).toBe(true);
    expect(uno('lab-open-all')?.classList.contains('btn-sm')).toBe(true);
  });

  it('una tira de ambiente repetida en la zona se pinta dos veces sin claves duplicadas', () => {
    const avisos = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const errores = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const zona = MAP_ZONA.zones['1'];
    const repetida = { ...zona.ambient[0], x: 100, y: 200 };
    pintar(normalizeMap({ ...MAP_ZONA, zones: { '1': { ...zona, ambient: [zona.ambient[0], repetida] } } }));
    // Angular solo comprueba las claves al reconciliar la lista: hace falta un segundo pintado (el siguiente tic)
    fixture.componentRef.setInput('clock', 250);
    fixture.detectChanges();

    expect(todos('lab-ambient').map((a) => a.style.left)).toEqual(['20px', '100px']);
    const claveRepetida = [...avisos.mock.calls, ...errores.mock.calls].some((c) => String(c[0]).includes('NG0955'));
    expect(claveRepetida).toBe(false);
    avisos.mockRestore();
    errores.mockRestore();
  });

  it('une la parada con su zona por el jefe: con zonas sueltas (1 y 7) la 2.ª parada no se une a la 7', () => {
    const zona = MAP_ZONA.zones['1'];
    pintar(normalizeMap({
      ...MAP_ZONA,
      zones: { '1': zona, '7': { ...zona, boss: 'rey' } },
      paper: { ...MAP_ZONA.paper, stops: [{ boss: 'ardilla', x: 40, y: 280 }, { boss: 'buho', x: 80, y: 200 }] },
    }));

    expect(mapa.zoneIdOfStop(0)).toBe('1');
    expect(mapa.zoneIdOfStop(1)).toBe('2');
    (todos('lab-stop')[1] as HTMLButtonElement).click();
    repintar();
    expect(mapa.isOpen('2')).toBe(false);
    expect(mapa.isOpen('7')).toBe(true);
  });

  it('el tic del reloj no reajusta zona ni progreso: solo un mapa nuevo', () => {
    const map = normalizeMap(MAP_ZONA);
    pintar(map, { clock: 0 });
    mapa.setProgress(2);
    mapa.zoneId = 'otra';

    fixture.componentRef.setInput('clock', 33);
    fixture.detectChanges();
    expect(mapa.zoneId).toBe('otra');
    expect(mapa.progress).toBe(2);

    fixture.componentRef.setInput('map', normalizeMap(MAP_VACIO));
    fixture.detectChanges();
    expect(mapa.zoneId).toBeNull();
    expect(mapa.progress).toBe(0);
  });

  it('cerrar una zona cierra su parada en el papel y deja sus puntos en «locked»', () => {
    pintar(normalizeMap(MAP_ZONA));

    uno('lab-zone-open')?.dispatchEvent(new Event('change'));
    repintar();

    expect(uno('lab-stop')?.getAttribute('data-open')).toBe('false');
    expect(uno('lab-stop')?.innerHTML).toContain('paper-stop-ardilla-locked.png');
    // no hay sprites «locked» en el manifiesto falso: todos los puntos caen en el respaldo
    expect(todos('lab-node')).toHaveLength(0);
    expect(todos('lab-node-fallback')).toHaveLength(3);

    (uno('lab-stop') as HTMLButtonElement).click();
    repintar();
    expect(uno('lab-stop')?.getAttribute('data-open')).toBe('true');
    expect(mapa.isOpen('1')).toBe(true);
  });
});
