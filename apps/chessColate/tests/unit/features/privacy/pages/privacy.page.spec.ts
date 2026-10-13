import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { IonContent, IonIcon } from '@ionic/angular/standalone';

import { PrivacyPage } from '@features/privacy/pages/privacy.page';

import { NavbarFalsa } from '@tests/support/racha-ajustes-recordatorios';

/**
 * Política de privacidad: texto legal estático. Se comprueba lo que no puede
 * faltar (secciones exigidas por las tiendas, contacto y enlace de salida) y que
 * el enlace de "Home" funciona.
 */
describe('PrivacyPage', () => {
  let fixture: ComponentFixture<PrivacyPage>;
  const router = { navigate: jest.fn() };

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [PrivacyPage],
      providers: [{ provide: Router, useValue: router }],
    })
      .overrideComponent(PrivacyPage, {
        set: { imports: [IonContent, IonIcon, NavbarFalsa] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PrivacyPage);
    fixture.detectChanges();
  });

  it('muestra el título de la política', () => {
    expect(el().querySelector('h1')?.textContent?.trim()).toBe('Privacy Policy');
  });

  it.each([
    'Interpretation and Definitions',
    'Collecting and Using Your Personal Data',
    'Delete Your Personal Data',
    "Children's Privacy",
    'Changes to this Privacy Policy',
    'Contact Us',
  ])('incluye la sección "%s"', (seccion) => {
    const titulos = Array.from(el().querySelectorAll('h2, h3')).map((h) =>
      h.textContent?.trim()
    );

    expect(titulos).toContain(seccion);
  });

  it('ofrece un correo de contacto', () => {
    const correo = el().querySelector('a[href^="mailto:"]');

    expect(correo).not.toBeNull();
    expect(correo?.getAttribute('href')).toBe('mailto:developer.alzate@gmail.com');
  });

  it('el enlace al sitio web se abre en otra pestaña sin filtrar el origen', () => {
    const web = el().querySelector('a[href="https://chesscolate.com/"]');

    expect(web?.getAttribute('target')).toBe('_blank');
    expect(web?.getAttribute('rel')).toContain('noopener');
  });

  it('el enlace "Home" del encabezado navega a /home', () => {
    const home = Array.from(el().querySelectorAll('.breadcrumbs a')).find((a) =>
      (a.textContent ?? '').includes('Home')
    ) as HTMLElement;

    home.click();

    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });
});
