import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideTranslocoTesting } from '@tests/support/transloco-testing';

import { CHAPTERS } from '@features/chess-runner/campaign/runner-curriculum';
import { RunnerMapComponent } from '@features/chess-runner/components/runner-map/runner-map.component';
import { GUARDIANS } from '@features/chess-runner/story/story-scenes';

describe('RunnerMapComponent', () => {
  afterEach(() => jest.restoreAllMocks());

  let fixture: ComponentFixture<RunnerMapComponent>;
  let mapa: RunnerMapComponent;

  const urls = new Map(GUARDIANS.map((clave) => [clave, `data:pieza-${clave}`] as const));
  const nodos = () => Array.from(fixture.nativeElement.querySelectorAll('[data-testid=map-node]')) as HTMLElement[];
  const estados = () => nodos().map((n) => n.getAttribute('data-state'));

  function pintar(entradas: Partial<RunnerMapComponent>) {
    fixture = TestBed.createComponent(RunnerMapComponent);
    mapa = fixture.componentInstance;
    Object.assign(mapa, { urls, ...entradas });
    fixture.detectChanges();
  }

  beforeEach(async () => {
    // jsdom no dibuja: los iconos de los poderes salen vacíos (sin ruido en la consola)
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    await TestBed.configureTestingModule({
      imports: [RunnerMapComponent],
      providers: [provideTranslocoTesting({ CHESS_RUNNER: { map: { label: 'Camino: {{done}} de {{total}}' } } })],
    }).compileComponents();
  });

  it('hay un nodo por capítulo, en cuatro filas de cinco', () => {
    pintar({ chapter: 0 });

    expect(nodos()).toHaveLength(CHAPTERS.length);
    expect(mapa.rows.map((fila) => fila.length)).toEqual([5, 5, 5, 5]);
  });

  it('al principio el actual es el primero y todos los demás están por delante', () => {
    pintar({ chapter: 0 });

    expect(estados()).toEqual(['current', ...Array(CHAPTERS.length - 1).fill('locked')]);
  });

  it('los anteriores al actual están vencidos', () => {
    pintar({ chapter: 4 });

    expect(estados()).toEqual(['beaten', 'beaten', 'beaten', 'beaten', 'current', ...Array(CHAPTERS.length - 5).fill('locked')]);
    expect(mapa.beaten).toBe(4);
  });

  it('con la campaña terminada están todos vencidos y ninguno es el actual', () => {
    pintar({ chapter: CHAPTERS.length });

    expect(estados().every((e) => e === 'beaten')).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-testid=map-here]')).toBeNull();
    expect(mapa.beaten).toBe(CHAPTERS.length);
  });

  it('el actual lleva la marca de «aquí está el perrito», y solo ese', () => {
    pintar({ chapter: 3 });

    expect(fixture.nativeElement.querySelectorAll('[data-testid=map-here]')).toHaveLength(1);
    expect(nodos()[3].querySelector('[data-testid=map-here]')).not.toBeNull();
  });

  it('cada nodo enseña la pieza guardiana de su mundo, con las piezas del set del usuario', () => {
    pintar({ chapter: 2 });

    const imagenes = nodos().map((n) => n.querySelector('img')!.getAttribute('src'));
    expect(imagenes).toEqual(GUARDIANS.map((clave) => `data:pieza-${clave}`));
  });

  it('el último es el jefe: el rey, con su fondo propio', () => {
    pintar({ chapter: 0 });

    expect(mapa.nodes[CHAPTERS.length - 1].boss).toBe(true);
    expect(mapa.nodes.filter((n) => n.boss)).toHaveLength(1);
    expect(mapa.nodes[CHAPTERS.length - 1].key).toBe('bk');
  });

  it('los que faltan se ven en silueta; los vencidos, no', () => {
    pintar({ chapter: 2 });

    const silueta = (i: number) => nodos()[i].querySelector('img')!.classList.contains('map-silhouette');
    expect([silueta(0), silueta(1), silueta(2), silueta(3), silueta(9)]).toEqual([false, false, false, true, true]);
  });

  it('los vencidos enseñan sus estrellas: llenas las ganadas y apagadas las demás', () => {
    pintar({ chapter: 3, stars: [3, 2, 1] });

    const estrellas = (i: number) =>
      Array.from(nodos()[i].querySelectorAll('ion-icon')).map((e) => (e.classList.contains('text-warning') ? 1 : 0));
    expect(estrellas(0)).toEqual([1, 1, 1]);
    expect(estrellas(1)).toEqual([1, 1, 0]);
    expect(estrellas(2)).toEqual([1, 0, 0]);
    // Los que aún no se han vencido no enseñan estrellas
    expect(estrellas(3)).toEqual([]);
    expect(estrellas(8)).toEqual([]);
  });

  it('un capítulo vencido sin estrellas guardadas se enseña con todas apagadas', () => {
    pintar({ chapter: 1, stars: [] });

    expect(nodos()[0].querySelectorAll('ion-icon.text-warning')).toHaveLength(0);
    expect(nodos()[0].querySelectorAll('ion-icon')).toHaveLength(3);
  });

  it('enseña los poderes ganados, uno por uno; sin ninguno no sale la fila', () => {
    pintar({ chapter: 0, powers: [] });
    expect(fixture.nativeElement.querySelector('[data-testid=map-powers]')).toBeNull();

    fixture.destroy();
    pintar({ chapter: 3, powers: ['nose', 'spring', 'shield'] });
    expect(fixture.nativeElement.querySelectorAll('[data-testid=map-powers] img')).toHaveLength(3);
  });

  it('tiene una etiqueta para quien no ve el dibujo: cuántos guardianes lleva vencidos', () => {
    pintar({ chapter: 4 });

    const mapaEl = fixture.nativeElement.querySelector('[data-testid=map]') as HTMLElement;
    expect(mapaEl.getAttribute('role')).toBe('img');
    expect(mapaEl.getAttribute('aria-label')).toBe(`Camino: 4 de ${CHAPTERS.length}`);
  });

  it('sin las imágenes del set (todavía no cargaron) enseña los nodos vacíos y no rompe', () => {
    pintar({ chapter: 2, urls: new Map() });

    expect(nodos()).toHaveLength(CHAPTERS.length);
    expect(fixture.nativeElement.querySelectorAll('[data-testid=map-node] img:not([data-testid=map-power])')).toHaveLength(0);
  });

  it('cada capítulo lleva el nombre de su patrón, si se pasan', () => {
    pintar({ chapter: 1, names: CHAPTERS.map((c) => `Tema ${c.theme}`) });

    const nombres = Array.from(fixture.nativeElement.querySelectorAll('[data-testid=map-name]')).map((n) => (n as HTMLElement).textContent?.trim());
    expect(nombres).toEqual(CHAPTERS.map((c) => `Tema ${c.theme}`));
  });

  it('los capítulos que dan un poder lo enseñan: son uno de cada dos', () => {
    pintar({ chapter: 0 });

    const conPoder = nodos().filter((n) => n.querySelector('[data-testid=map-power]'));
    expect(conPoder).toHaveLength(CHAPTERS.filter((c) => c.power).length);
    expect(mapa.nodes.filter((n) => n.power).map((n) => n.index)).toEqual([1, 3, 5, 7, 9, 11, 13, 15, 17, 19]);
  });

  it('bajo cada guardián, una barrita con lo que se acierta de su patrón; sin ejercicios jugados, vacía', () => {
    pintar({
      chapter: 3,
      mastery: {
        [CHAPTERS[0].theme]: { solved: 9, failed: 1, lastSeen: 10 },
        [CHAPTERS[1].theme]: { solved: 1, failed: 2, lastSeen: 12 },
        [CHAPTERS[2].theme]: { solved: 1, failed: 1, lastSeen: 14 },
      },
    });

    expect(mapa.nodes.map((n) => n.accuracy).slice(0, 5)).toEqual([90, 33, 50, null, null]);
    const barras = fixture.nativeElement.querySelectorAll('[data-testid=map-accuracy]') as NodeListOf<HTMLElement>;
    expect(barras).toHaveLength(3);
    expect(barras[0].style.width).toBe('90%');
    expect(barras[0].className).toContain('bg-success');
    expect(barras[1].className).toContain('bg-error');
    expect(barras[2].className).toContain('bg-warning');
  });
});
