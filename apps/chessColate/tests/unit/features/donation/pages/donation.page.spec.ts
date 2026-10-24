// El inicio de sesión real arrastra Firebase/Auth: aquí solo importa que la
// página lo abra en un modal, así que se sustituye por una clase vacía.
jest.mock('@shared/components/login/login.component', () => ({
  LoginComponent: class LoginComponent {},
}));

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { Capacitor } from '@capacitor/core';
import {
  IonContent,
  IonIcon,
  LoadingController,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslocoPipe } from '@jsverse/transloco';

import {
  PurchasesError,
  PURCHASES_ERROR_CODE,
  RevenueCatService,
} from '@chesspark/revenuecat';

import { AnalyticsService } from '@core/analytics/analytics.service';
import { ProfileService } from '@core/account/profile.service';
import { LoginComponent } from '@shared/components/login/login.component';
import { DonationPage } from '@features/donation/pages/donation.page';

import {
  NavbarFalsa,
  controladorFalso,
  superposicionFalsa,
  translocoParaPruebas,
  vaciarPromesas,
} from '@tests/support/racha-ajustes-recordatorios';

/** Paquete de donación como lo entrega RevenueCat. */
function paquete(identifier: string, price: number, priceString: string, currencyCode = 'USD') {
  return { identifier, product: { price, priceString, currencyCode } };
}

/**
 * Pantalla de donación: exige sesión, carga los precios reales desde RevenueCat,
 * procesa la compra y traduce cada tipo de error a un aviso entendible.
 */
describe('DonationPage', () => {
  let fixture: ComponentFixture<DonationPage>;
  let page: DonationPage;
  let perfil$: BehaviorSubject<{ uid: string } | null>;

  const router = { navigate: jest.fn() };
  const revenueCat = {
    getOfferings: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
  };
  const analytics = { logEvent: jest.fn() };
  const loading = superposicionFalsa();
  const toast = superposicionFalsa();
  const modal = superposicionFalsa();
  const loadingController = controladorFalso(loading);
  const toastController = controladorFalso(toast);
  const modalController = controladorFalso(modal);

  const OFERTA = {
    current: {
      availablePackages: [
        paquete('donation_small', 2.99, '$2.99'),
        paquete('donation_medium', 5.99, '$5.99'),
        paquete('donation_large', 8.99, '$8.99'),
        paquete('suscripcion_mensual', 1, '$1.00'),
      ],
    },
  };

  async function crear(opciones: { sesion?: boolean; nativo?: boolean } = {}) {
    jest.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(!!opciones.nativo);
    if (opciones.sesion) {
      perfil$.next({ uid: 'u1' });
    }
    fixture = TestBed.createComponent(DonationPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
    await vaciarPromesas();
    fixture.detectChanges();
  }

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function avisoMostrado() {
    return toastController.create.mock.calls.map(([opciones]) => opciones);
  }

  /** Compra del paquete `donation_medium` ya cargado. */
  async function donarMedio() {
    await page.processDonation(page.donationOptions[1]);
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    perfil$ = new BehaviorSubject<{ uid: string } | null>(null);
    revenueCat.getOfferings.mockResolvedValue(OFERTA);
    revenueCat.purchasePackage.mockResolvedValue({ customerInfo: { id: 'ok' } });
    revenueCat.restorePurchases.mockResolvedValue({});
    analytics.logEvent.mockResolvedValue(undefined);
    loading.present.mockClear();
    loading.dismiss.mockClear();
    toast.present.mockClear();
    modal.present.mockClear();

    await TestBed.configureTestingModule({
      imports: [DonationPage, translocoParaPruebas()],
      providers: [
        { provide: RevenueCatService, useValue: revenueCat },
        { provide: LoadingController, useValue: loadingController },
        { provide: ToastController, useValue: toastController },
        { provide: ModalController, useValue: modalController },
        { provide: ProfileService, useValue: { profile$: perfil$.asObservable() } },
        { provide: Router, useValue: router },
        { provide: AnalyticsService, useValue: analytics },
      ],
    })
      .overrideComponent(DonationPage, {
        set: {
          imports: [CommonModule, TranslocoPipe, IonContent, IonIcon, NavbarFalsa],
        },
      })
      .compileComponents();

    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('en la web', () => {
    it('no pide las ofertas a la tienda ni avisa de un error que no es tal', async () => {
      await crear({ sesion: true });

      expect(revenueCat.getOfferings).not.toHaveBeenCalled();
      expect(avisoMostrado()).toEqual([]);
    });

    it('tocar una oferta explica que las donaciones son del móvil', async () => {
      await crear({ sesion: true });

      await page.processDonation(page.donationOptions[1]);

      expect(revenueCat.purchasePackage).not.toHaveBeenCalled();
      expect(avisoMostrado()).toEqual([
        expect.objectContaining({ message: 'DONATION.messages.mobileOnly', color: 'warning' }),
      ]);
    });

    it('restaurar compras también lo explica sin abrir la carga', async () => {
      await crear({ sesion: true });

      await page.restorePurchases();

      expect(revenueCat.restorePurchases).not.toHaveBeenCalled();
      expect(loadingController.create).not.toHaveBeenCalled();
      expect(avisoMostrado()).toEqual([
        expect.objectContaining({ message: 'DONATION.messages.mobileOnly', color: 'warning' }),
      ]);
    });
  });

  describe('sin sesión', () => {
    it('pide iniciar sesión y no ofrece importes ni consulta RevenueCat', async () => {
      await crear();

      expect(page.isAuthenticated).toBe(false);
      expect(el().textContent).toContain('DONATION.page.loginRequired');
      expect(el().textContent).not.toContain('DONATION.page.chooseAmount');
      expect(revenueCat.getOfferings).not.toHaveBeenCalled();
    });

    it('el botón de entrar abre el modal de inicio de sesión en modo "login"', async () => {
      await crear();

      (el().querySelector('button.btn-primary') as HTMLButtonElement).click();
      await vaciarPromesas();

      expect(modalController.create).toHaveBeenCalledWith({
        component: LoginComponent,
        componentProps: { segmentEmailPassword: 'login' },
      });
      expect(modal.present).toHaveBeenCalledTimes(1);
    });

    it('al iniciar sesión carga las opciones y desaparece el aviso', async () => {
      await crear({ nativo: true });

      perfil$.next({ uid: 'u1' });
      await vaciarPromesas();
      fixture.detectChanges();

      expect(page.isAuthenticated).toBe(true);
      expect(revenueCat.getOfferings).toHaveBeenCalledTimes(1);
      expect(el().textContent).not.toContain('DONATION.page.loginRequired');
      expect(el().textContent).toContain('DONATION.page.chooseAmount');
    });
  });

  describe('con sesión: opciones de donación', () => {
    it('muestra los tres importes con el precio y la moneda que devuelve RevenueCat', async () => {
      await crear({ sesion: true, nativo: true });

      expect(page.donationOptions.map((o) => o.label)).toEqual([
        '$2.99 USD',
        '$5.99 USD',
        '$8.99 USD',
      ]);
      expect(page.donationOptions.map((o) => o.amount)).toEqual([2.99, 5.99, 8.99]);
      const texto = el().textContent ?? '';
      expect(texto).toContain('$2.99 USD');
      expect(texto).toContain('$5.99 USD');
      expect(texto).toContain('$8.99 USD');
    });

    it('solo conserva los paquetes "donation_" de la oferta', async () => {
      await crear({ sesion: true, nativo: true });

      expect(page.availablePackages.map((p) => p.identifier)).toEqual([
        'donation_small',
        'donation_medium',
        'donation_large',
      ]);
    });

    it('destaca la opción del medio como la más popular', async () => {
      await crear({ sesion: true, nativo: true });

      const popular = el().querySelectorAll('.badge-primary');
      expect(popular).toHaveLength(1);
      expect(popular[0].textContent).toContain('DONATION.page.mostPopular');
    });

    it('si RevenueCat no trae un paquete conserva el importe por defecto de esa opción', async () => {
      revenueCat.getOfferings.mockResolvedValue({
        current: { availablePackages: [paquete('donation_small', 2.99, '$2.99')] },
      });
      await crear({ sesion: true, nativo: true });

      expect(page.donationOptions.map((o) => o.label)).toEqual(['$2.99 USD', '$5', '$8']);
    });

    it('sin oferta actual deja los importes por defecto', async () => {
      revenueCat.getOfferings.mockResolvedValue({ current: null });
      await crear({ sesion: true, nativo: true });

      expect(page.donationOptions.map((o) => o.label)).toEqual(['$2', '$5', '$8']);
      expect(page.availablePackages).toEqual([]);
    });

    it('mientras carga enseña un indicador y no los importes', async () => {
      revenueCat.getOfferings.mockReturnValue(new Promise(() => undefined));
      await crear({ sesion: true, nativo: true });

      expect(page.isLoading).toBe(true);
      expect(el().querySelector('.loading')).not.toBeNull();
      expect(el().textContent).not.toContain('DONATION.page.chooseAmount');
    });

    it('si falla la carga avisa con un toast de error y deja de cargar', async () => {
      revenueCat.getOfferings.mockRejectedValue(new Error('sin red'));
      await crear({ sesion: true, nativo: true });

      expect(page.isLoading).toBe(false);
      expect(avisoMostrado()).toEqual([
        expect.objectContaining({
          message: 'DONATION.messages.loadFailed',
          color: 'danger',
        }),
      ]);
    });
  });

  describe('donar', () => {
    it('pulsar un importe inicia la compra de su paquete', async () => {
      await crear({ sesion: true, nativo: true });

      const tarjetas = el().querySelectorAll('.card.cursor-pointer');
      (tarjetas[2] as HTMLElement).click();
      await vaciarPromesas();

      expect(revenueCat.purchasePackage).toHaveBeenCalledWith(
        expect.objectContaining({ identifier: 'donation_large' })
      );
    });

    it('compra correcta: muestra "procesando", agradece y registra donation_completed', async () => {
      await crear({ sesion: true, nativo: true });

      await donarMedio();

      expect(loadingController.create).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'DONATION.messages.processing' })
      );
      expect(loading.present).toHaveBeenCalledTimes(1);
      expect(loading.dismiss).toHaveBeenCalledTimes(1);
      expect(avisoMostrado()).toEqual([
        expect.objectContaining({ message: 'DONATION.messages.thanks', color: 'success' }),
      ]);
      expect(analytics.logEvent).toHaveBeenCalledWith('donation_completed', {
        value: 5.99,
        currency: 'USD',
        item_id: 'donation_medium',
      });
    });

    it('si no hay paquete para esa opción avisa y no abre ninguna compra', async () => {
      revenueCat.getOfferings.mockResolvedValue({ current: { availablePackages: [] } });
      await crear({ sesion: true, nativo: true });

      await donarMedio();

      expect(avisoMostrado()).toEqual([
        expect.objectContaining({ message: 'DONATION.messages.optionUnavailable', color: 'danger' }),
      ]);
      expect(loadingController.create).not.toHaveBeenCalled();
      expect(revenueCat.purchasePackage).not.toHaveBeenCalled();
    });

    it('si el usuario cancela la compra no se le muestra ningún error', async () => {
      await crear({ sesion: true, nativo: true });
      revenueCat.purchasePackage.mockRejectedValue(
        new PurchasesError(PURCHASES_ERROR_CODE.PURCHASE_CANCELLED, 'cancelada')
      );

      await donarMedio();

      expect(avisoMostrado()).toEqual([]);
      expect(loading.dismiss).toHaveBeenCalledTimes(1);
      expect(analytics.logEvent).not.toHaveBeenCalledWith('donation_completed', expect.anything());
    });

    it.each([
      [PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED, 'DONATION.messages.purchasesNotAllowed', 'warning'],
      [PURCHASES_ERROR_CODE.NETWORK_ERROR, 'DONATION.messages.networkError', 'danger'],
      [PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE, 'DONATION.messages.notAvailableNow', 'warning'],
    ])('el error %s se explica con "%s"', async (codigo, mensaje, color) => {
      await crear({ sesion: true, nativo: true });
      revenueCat.purchasePackage.mockRejectedValue(new PurchasesError(codigo, 'x'));

      await donarMedio();

      expect(avisoMostrado()).toEqual([expect.objectContaining({ message: mensaje, color })]);
      expect(loading.dismiss).toHaveBeenCalledTimes(1);
    });

    it('un error de compra no catalogado muestra el mensaje que trae', async () => {
      await crear({ sesion: true, nativo: true });
      revenueCat.purchasePackage.mockRejectedValue(
        new PurchasesError(PURCHASES_ERROR_CODE.STORE_PROBLEM, 'La tienda no responde')
      );

      await donarMedio();

      expect(avisoMostrado()).toEqual([
        expect.objectContaining({ message: 'DONATION.messages.errorWith', color: 'danger' }),
      ]);
    });

    it('un fallo inesperado (que no es de RevenueCat) muestra el aviso genérico', async () => {
      await crear({ sesion: true, nativo: true });
      revenueCat.purchasePackage.mockRejectedValue(new Error('boom'));

      await donarMedio();

      expect(avisoMostrado()).toEqual([
        expect.objectContaining({ message: 'DONATION.messages.processFailed', color: 'danger' }),
      ]);
      expect(loading.dismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('restaurar compras', () => {
    it('restaura y confirma con un toast de éxito', async () => {
      await crear({ nativo: true });

      await page.restorePurchases();

      expect(revenueCat.restorePurchases).toHaveBeenCalledTimes(1);
      expect(loading.dismiss).toHaveBeenCalledTimes(1);
      expect(avisoMostrado()).toEqual([
        expect.objectContaining({ message: 'DONATION.messages.restored', color: 'success' }),
      ]);
    });

    it('si falla avisa del error y cierra el indicador de carga', async () => {
      await crear({ nativo: true });
      revenueCat.restorePurchases.mockRejectedValue(new Error('fallo'));

      await page.restorePurchases();

      expect(loading.dismiss).toHaveBeenCalledTimes(1);
      expect(avisoMostrado()).toEqual([
        expect.objectContaining({ message: 'DONATION.messages.restoreFailed', color: 'danger' }),
      ]);
    });

    it('el enlace del pie lanza la restauración', async () => {
      await crear({ nativo: true });

      (el().querySelector('button.btn-link') as HTMLButtonElement).click();
      await vaciarPromesas();

      expect(revenueCat.restorePurchases).toHaveBeenCalledTimes(1);
    });
  });

  describe('otros', () => {
    it('los avisos duran 3 segundos y salen abajo', async () => {
      await crear({ nativo: true });

      await page.restorePurchases();

      expect(avisoMostrado()[0]).toMatchObject({ duration: 3000, position: 'bottom' });
      expect(toast.present).toHaveBeenCalledTimes(1);
    });

    it('goBack vuelve al inicio', async () => {
      await crear();

      page.goBack();

      expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('recuerda si corre en la app nativa', async () => {
      await crear({ nativo: true });

      expect(page.isNativePlatform).toBe(true);
    });

    it('al destruir la pantalla deja de escuchar el perfil', async () => {
      await crear();
      fixture.destroy();

      perfil$.next({ uid: 'u1' });

      expect(revenueCat.getOfferings).not.toHaveBeenCalled();
    });
  });
});
