import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { TranslocoPipe } from '@jsverse/transloco';

import { PIECE_CREDITS } from '@features/settings/config/credits.config';
import { MUSIC_CREDITS } from '@features/settings/config/music-credits.config';
import { CreditsPage } from '@features/settings/pages/credits/credits.page';

import { NavbarFalsa, translocoParaPruebas } from '@tests/support/racha-ajustes-recordatorios';

/**
 * Pantalla de créditos: pública, solo lectura. Muestra autor y licencia de cada set de piezas,
 * la fuente de los puzzles y las pistas de la música del directo agrupadas por licencia.
 */
describe('CreditsPage', () => {
  let fixture: ComponentFixture<CreditsPage>;
  let page: CreditsPage;
  const router = { navigate: jest.fn() };

  const raiz = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    jest.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [CreditsPage, translocoParaPruebas()],
      providers: [{ provide: Router, useValue: router }],
    })
      .overrideComponent(CreditsPage, {
        set: { imports: [IonContent, IonIcon, TranslocoPipe, NavbarFalsa] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(CreditsPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('lista un renglón por cada set de piezas, con su autor y su licencia', () => {
    const filas = raiz().querySelectorAll('[data-piece]');

    expect(filas).toHaveLength(Object.keys(PIECE_CREDITS).length);
    const firi = raiz().querySelector('[data-piece="firi"]') as HTMLElement;
    expect(firi.textContent).toContain('James Faure');
    expect(firi.textContent).toContain('CC BY 4.0');
  });

  it('un set sin página de autor muestra el nombre sin enlace', () => {
    const totoy = raiz().querySelector('[data-piece="totoy"]') as HTMLElement;

    expect(totoy.textContent).toContain('Kosal Sen');
    expect(totoy.querySelector('a[href*="itch.io"], a[href*="github.com"]')).toBeNull();
  });

  it('la música aparece en un grupo por licencia, con todas las pistas', () => {
    const grupos = Array.from(raiz().querySelectorAll('details[data-license]'));
    const pistas = raiz().querySelectorAll('details[data-license] li');

    expect(grupos.length).toBe(page.musicGroups.length);
    expect(pistas).toHaveLength(MUSIC_CREDITS.length);
    expect(grupos[0].getAttribute('data-license')).toBe('CC-BY-3.0');
  });

  it('cada pista enlaza a su página de origen', () => {
    const primera = raiz().querySelector('details[data-license] li a') as HTMLAnchorElement;

    expect(primera.getAttribute('href')).toBe(MUSIC_CREDITS[0].url);
    expect(primera.textContent).toContain(MUSIC_CREDITS[0].title);
  });

  it('todos los enlaces externos se abren aparte y sin dar acceso a la app', () => {
    const externos = Array.from(raiz().querySelectorAll('a[href^="http"]'));

    expect(externos.length).toBeGreaterThan(MUSIC_CREDITS.length);
    externos.forEach((a) => {
      expect(a.getAttribute('target')).toBe('_blank');
      expect(a.getAttribute('rel')).toContain('noopener');
    });
  });

  it('el resumen cuenta pistas y autores', () => {
    expect(page.musicSummary.tracks).toBe(MUSIC_CREDITS.length);
    expect(page.musicSummary.authors).toBe(new Set(MUSIC_CREDITS.map((p) => p.author)).size);
  });

  it('las migas de pan llevan a inicio y a ajustes', () => {
    page.goToHome();
    page.goToSettings();

    expect(router.navigate).toHaveBeenNthCalledWith(1, ['/home']);
    expect(router.navigate).toHaveBeenNthCalledWith(2, ['/settings']);
  });
});
