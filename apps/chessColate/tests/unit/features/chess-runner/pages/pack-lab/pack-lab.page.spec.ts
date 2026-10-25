import { readFileSync } from 'fs';
import { resolve } from 'path';

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { PackLabPage } from '@features/chess-runner/pages/pack-lab/pack-lab.page';
import { PackAssets, PackAssetsService } from '@features/chess-runner/services/pack-assets.service';
import { LAB_JUMP_MS } from '@features/chess-runner/utils/pack-lab.util';
import { normalizeMap, normalizePack, normalizeRunnerBackdrop } from '@features/chess-runner/utils/pack-manifest.util';

import { provideTranslocoTesting } from '@tests/support/transloco-testing';
import { MAP_VACIO, MAP_ZONA, PACK_UNO, PACK_VARIOS } from '@tests/support/pack-lab';

const RUNNER = {
  sprites: {
    'scene-floor': { file: 'scene-floor.png', frameW: 32, frameH: 20, frames: 1 },
    'scene-sky': { file: 'scene-sky.png', frameW: 4, frameH: 128, frames: 1 },
  },
};

/** Los textos reales de `es.json`, para las pruebas que fijan un rótulo concreto. */
const ES = JSON.parse(readFileSync(resolve(__dirname, '../../../../../../src/assets/i18n/es.json'), 'utf-8'));
const EN = JSON.parse(readFileSync(resolve(__dirname, '../../../../../../src/assets/i18n/en.json'), 'utf-8'));

const assetsDe = (pack: unknown, map: unknown, missing: PackAssets['missing'] = []): PackAssets => ({
  characters: normalizePack(pack),
  map: normalizeMap(map),
  backdrop: normalizeRunnerBackdrop(RUNNER),
  missing,
  version: '',
});

describe('PackLabPage', () => {
  let fixture: ComponentFixture<PackLabPage>;
  let page: PackLabPage;
  let load: jest.Mock;
  let brokenImages: jest.Mock;
  let visibleHeight: jest.Mock;
  let router: { navigate: jest.Mock };

  const todos = (testid: string) => Array.from(fixture.nativeElement.querySelectorAll(`[data-testid=${testid}]`)) as HTMLElement[];
  const uno = (testid: string) => fixture.nativeElement.querySelector(`[data-testid=${testid}]`) as HTMLElement | null;

  /** Avanza el reloj a pasos de 50 ms, como lo haría el bucle de animación. */
  function correr(ms: number) {
    for (let t = 0; t < ms; t += 50) page.advance(Math.min(50, ms - t));
  }

  async function abrir(
    assets: PackAssets,
    rotas: string[] = [],
    opciones: { altos?: Record<string, number>; es?: Record<string, unknown> } = {},
  ) {
    load = jest.fn().mockResolvedValue(assets);
    // Sin canvas (jsdom) el servicio da `null`; con `altos` se finge lo que mediría en el navegador, por archivo
    visibleHeight = jest.fn().mockImplementation(async (url: string) => {
      const archivo = Object.keys(opciones.altos ?? {}).find((f) => url.endsWith(f));
      return archivo ? (opciones.altos as Record<string, number>)[archivo] : null;
    });
    brokenImages = jest.fn().mockImplementation(async (urls: string[]) => urls.filter((u) => rotas.some((r) => u.endsWith(r))));
    router = { navigate: jest.fn().mockResolvedValue(true) };
    await TestBed.configureTestingModule({
      imports: [PackLabPage],
      providers: [
        provideTranslocoTesting(opciones.es),
        { provide: PackAssetsService, useValue: { load, brokenImages, visibleHeight } },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PackLabPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('con solo Choco y el mapa vacío: lo elige, lo pinta a escala y muestra «aún no hay zonas»', async () => {
    await abrir(assetsDe(PACK_UNO, MAP_VACIO));

    expect(todos('lab-character').map((b) => b.getAttribute('data-id'))).toEqual(['choco']);
    expect(todos('lab-figure').map((f) => f.getAttribute('data-id'))).toEqual(['choco']);
    expect(todos('lab-anim').map((b) => b.getAttribute('data-anim'))).toEqual(['run', 'jump', 'hurt', 'idle', 'happy', 'tour']);
    expect(uno('lab-cell')?.textContent).toContain('54×43');
    expect(uno('lab-zones-empty')).not.toBeNull();
    expect(uno('lab-missing')).toBeNull();
  });

  it('con varios personajes los muestra todos y deja elegir uno o «Todos»', async () => {
    await abrir(assetsDe(PACK_VARIOS, MAP_ZONA));
    expect(todos('lab-figure')).toHaveLength(3);

    (todos('lab-character').find((b) => b.getAttribute('data-id') === 'nannukk') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(todos('lab-figure').map((f) => f.getAttribute('data-id'))).toEqual(['choco', 'luna']);

    (uno('lab-all') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(todos('lab-figure')).toHaveLength(3);

    (uno('lab-all') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(uno('lab-none-chosen')).not.toBeNull();
  });

  it('sin personajes ni manifiesto muestra el estado vacío y el aviso, sin controles', async () => {
    await abrir(assetsDe(null, null, ['pack', 'map']));

    expect(uno('lab-characters-empty')).not.toBeNull();
    expect(uno('lab-missing')?.textContent).toContain('PACK_LAB.missing');
    expect(uno('lab-controls')).toBeNull();
    expect(uno('lab-zones-empty')).not.toBeNull();
  });

  it('las animaciones avanzan con el reloj; en pausa se quedan y el paso a paso avanza un cuadro', async () => {
    await abrir(assetsDe(PACK_UNO, MAP_VACIO));
    const cuadro = () => page.figures[0].pose.frame;

    page.advance(90);
    expect(cuadro()).toBe(1);

    page.togglePause();
    page.advance(200);
    expect(cuadro()).toBe(1);

    page.step();
    expect(cuadro()).toBe(2);
    expect(page.paused).toBe(true);
  });

  it('la velocidad cambia lo que avanza el reloj', async () => {
    await abrir(assetsDe(PACK_UNO, MAP_VACIO));

    page.setSpeed(0.5);
    page.advance(100);

    expect(page.animMs).toBe(50);
  });

  it('el zoom es entero (1× a 4×) y escala la manada', async () => {
    await abrir(assetsDe(PACK_UNO, MAP_VACIO));

    (todos('lab-zoom').find((b) => b.textContent?.includes('3')) as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(page.zoom).toBe(3);
    const sprite = uno('lab-figure')?.querySelector('app-pack-sprite') as HTMLElement;
    expect(sprite.style.width).toBe('162px');
    page.setZoom(7.2);
    expect(page.zoom).toBe(4);
  });

  it('en la carrerita todos corren y saltan a la vez', async () => {
    await abrir(assetsDe(PACK_VARIOS, MAP_VACIO));
    expect(page.racers.map((r) => r.pose.anim)).toEqual(['run', 'run', 'run']);

    (uno('lab-jump') as HTMLButtonElement).click();
    correr(LAB_JUMP_MS / 2);

    // Luna no tiene salto: sigue corriendo
    expect(page.racers.map((r) => r.pose.anim)).toEqual(['jump', 'jump', 'run']);
    expect(page.racers[0].lift).toBe(page.racers[1].lift);
    expect(page.racers[0].lift).toBeGreaterThan(0);

    correr(LAB_JUMP_MS);
    expect(page.racers[0].pose.anim).toBe('run');
  });

  it('un salto de reloj grande (pestaña en segundo plano) no hace saltar la animación', async () => {
    await abrir(assetsDe(PACK_UNO, MAP_VACIO));

    page.advance(10_000);

    expect(page.animMs).toBeLessThanOrEqual(250);
  });

  it('los fondos son «sin fondo», el suelo del runner y las escenas de zona que existan', async () => {
    await abrir(assetsDe(PACK_UNO, MAP_ZONA));

    expect(todos('lab-background')).toHaveLength(3);
    expect(page.backgroundStyle(false)).toContain('scene-floor.png');
    page.setBackground('zone:1');
    expect(page.backgroundStyle(false)).toContain('assets/images/map/map-zone-1.png');
    page.setBackground('none');
    expect(page.backgroundStyle(false)).toBeNull();
  });

  it('recargar vuelve a pedir los manifiestos saltándose la caché y pinta lo nuevo', async () => {
    await abrir(assetsDe(PACK_UNO, MAP_VACIO));
    load.mockResolvedValue(assetsDe(PACK_VARIOS, MAP_ZONA));

    (uno('lab-reload') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(load).toHaveBeenLastCalledWith({ fresh: true });
    // estaban todos elegidos: los que llegan también se eligen
    expect(todos('lab-figure')).toHaveLength(3);
    expect(todos('lab-zone')).toHaveLength(1);
  });

  it('la regla de alturas va en una columna sticky a la izquierda, con un número por marca', async () => {
    await abrir(assetsDe(PACK_VARIOS, MAP_VACIO));

    const regla = uno('lab-ruler');
    expect(regla?.classList.contains('sticky')).toBe(true);
    expect(regla?.classList.contains('left-0')).toBe(true);
    // la regla está dentro del escenario que se desplaza, no fuera
    expect(uno('lab-pack-scroll')?.contains(regla)).toBe(true);
    expect(todos('lab-tick-label').map((t) => t.textContent?.trim())).toEqual(page.ticks.map(String));
  });

  it('los controles de velocidad, zoom y fondo son btn-sm (táctiles)', async () => {
    await abrir(assetsDe(PACK_UNO, MAP_ZONA));

    const botones = [...todos('lab-speed'), ...todos('lab-zoom'), ...todos('lab-background')];
    expect(botones.length).toBeGreaterThan(0);
    expect(botones.every((b) => b.classList.contains('btn-sm') && !b.classList.contains('btn-xs'))).toBe(true);
  });

  it('avisa de los PNG que no cargan, en general y en la tarjeta del personaje', async () => {
    await abrir(assetsDe(PACK_VARIOS, MAP_ZONA), ['pack-luna-run.png', 'map-zone-1.png']);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(brokenImages).toHaveBeenCalled();
    expect(page.brokenFiles.sort()).toEqual(['map-zone-1.png', 'pack-luna-run.png']);
    expect(uno('lab-broken')?.textContent).toContain('PACK_LAB.broken');
    const tarjetas = todos('lab-character-broken');
    expect(tarjetas).toHaveLength(1);
    expect(tarjetas[0].closest('[data-testid=lab-character-data]')?.getAttribute('data-id')).toBe('luna');
  });

  it('si todo carga no hay aviso de imágenes', async () => {
    await abrir(assetsDe(PACK_UNO, MAP_VACIO));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(uno('lab-broken')).toBeNull();
    expect(uno('lab-character-broken')).toBeNull();
  });

  it('el dato de alto es el «Alto de celda» (cellH − 1: 43 → 42) en la tarjeta, bajo el perro y en la ayuda', async () => {
    await abrir(assetsDe(PACK_UNO, MAP_VACIO), [], { es: ES });

    const tarjeta = uno('lab-character-data') as HTMLElement;
    expect(page.cellHeight(page.characters[0])).toBe(42);
    expect(uno('lab-height')?.textContent?.trim()).toBe('42 px');
    expect(uno('lab-height')?.previousElementSibling?.textContent?.trim()).toBe('Alto de celda');
    expect(tarjeta.textContent).not.toContain('Alto de pie');
    expect(uno('lab-name')?.textContent?.trim()).toBe('Choco · 42');
    expect(uno('lab-pack')?.textContent).toContain('su alto de celda (cellH − 1)');
    expect(ES.PACK_LAB.data.height).toBe('Alto de celda');
    expect(EN.PACK_LAB.data.height).toBe('Cell height');
    expect(EN.PACK_LAB.pack.hint).toContain('its cell height (cellH − 1)');
    expect(JSON.stringify([ES.PACK_LAB, EN.PACK_LAB])).not.toMatch(/alto de pie|standing height/i);
  });

  it('el «Alto visible (run)» sale de medir el primer cuadro de run; si no se puede medir, «—»', async () => {
    await abrir(assetsDe(PACK_VARIOS, MAP_VACIO), [], { altos: { 'pack-choco-run.png': 34 }, es: ES });
    await fixture.whenStable();
    fixture.detectChanges();

    const visible = (id: string) =>
      todos('lab-character-data').find((t) => t.getAttribute('data-id') === id)?.querySelector('[data-testid=lab-visible]');
    expect(visibleHeight).toHaveBeenCalledWith('assets/images/pack/pack-choco-run.png', 54, 43);
    expect(visible('choco')?.textContent?.trim()).toBe('34 px');
    expect(visible('choco')?.previousElementSibling?.textContent?.trim()).toBe('Alto visible (run)');
    // sin medida (imagen que no carga o sin canvas) no inventa un número
    expect(visible('nannukk')?.textContent?.trim()).toBe('—');
    expect(EN.PACK_LAB.data.visible).toBe('Visible height (run)');
  });

  it('volver lleva al Chess Runner', async () => {
    await abrir(assetsDe(PACK_UNO, MAP_VACIO));

    page.back();

    expect(router.navigate).toHaveBeenCalledWith(['/chess-runner']);
  });
});
