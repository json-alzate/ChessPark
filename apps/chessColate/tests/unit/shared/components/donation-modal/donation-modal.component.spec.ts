import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonToolbar,
  IonTitle,
  LoadingController,
  ToastController,
} from '@ionic/angular/standalone';

import { Package, PURCHASES_ERROR_CODE, PurchasesError, RevenueCatService } from '@chesspark/revenuecat';

import { DonationModalComponent } from '@shared/components/donation-modal/donation-modal.component';
import { provideTranslocoTesting } from '@tests/support/transloco-testing';

/** Deja correr las promesas pendientes. */
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

function makePackage(identifier: string, price: number, priceString: string): Package {
  return {
    identifier,
    packageType: 'MONTHLY',
    offeringIdentifier: 'default',
    product: { price, priceString, currencyCode: 'USD' },
  } as unknown as Package;
}

describe('DonationModalComponent', () => {
  let fixture: ComponentFixture<DonationModalComponent>;
  let component: DonationModalComponent;
  let revenueCat: { getOfferings: jest.Mock; purchasePackage: jest.Mock; restorePurchases: jest.Mock };
  let loading: { present: jest.Mock; dismiss: jest.Mock };
  let loadingController: { create: jest.Mock };
  let toast: { present: jest.Mock };
  let toastController: { create: jest.Mock };
  let modal: { dismiss: jest.Mock };

  const toastCalls = () => toastController.create.mock.calls.map(([options]) => options);

  /** Crea el componente; `native` decide la plataforma antes de que corra ngOnInit. */
  async function create(native: boolean) {
    jest.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(native);
    fixture = TestBed.createComponent(DonationModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await flush();
    // Sin el runtime de Ionic la consulta @ViewChild(IonModal) queda vacía: se inyecta el doble
    component.modal = modal as never;
  }

  beforeEach(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    revenueCat = {
      getOfferings: jest.fn().mockResolvedValue({
        current: {
          availablePackages: [
            makePackage('donation_small', 1.99, '$1.99'),
            makePackage('donation_large', 7.99, '$7.99'),
            makePackage('premium_monthly', 20, '$20'), // no es de donación
          ],
        },
      }),
      purchasePackage: jest.fn().mockResolvedValue({ customerInfo: { id: 'c1' } }),
      restorePurchases: jest.fn().mockResolvedValue(undefined),
    };
    loading = { present: jest.fn().mockResolvedValue(undefined), dismiss: jest.fn().mockResolvedValue(true) };
    loadingController = { create: jest.fn().mockResolvedValue(loading) };
    toast = { present: jest.fn().mockResolvedValue(undefined) };
    toastController = { create: jest.fn().mockResolvedValue(toast) };
    modal = { dismiss: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [DonationModalComponent],
      providers: [
        provideTranslocoTesting(),
        { provide: RevenueCatService, useValue: revenueCat },
        { provide: LoadingController, useValue: loadingController },
        { provide: ToastController, useValue: toastController },
      ],
    })
      // El modal de Ionic necesita su runtime (y el contenido va dentro de un
      // ng-template que solo se pinta al abrirlo): aquí se prueba la lógica.
      .overrideComponent(DonationModalComponent, {
        remove: { imports: [IonModal, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonIcon, IonItem, IonLabel, IonList] },
        add: { schemas: [CUSTOM_ELEMENTS_SCHEMA] },
      })
      .compileComponents();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('se crea con las tres donaciones de siempre', async () => {
    await create(false);

    expect(component).toBeTruthy();
    expect(component.donationOptions.map((o) => [o.id, o.amount])).toEqual([
      ['donation_small', 2],
      ['donation_medium', 5],
      ['donation_large', 8],
    ]);
  });

  describe('cargar opciones', () => {
    it('en la web no consulta RevenueCat', async () => {
      await create(false);

      expect(component.isNativePlatform).toBe(false);
      expect(revenueCat.getOfferings).not.toHaveBeenCalled();
    });

    it('en nativo toma de RevenueCat solo los paquetes de donación', async () => {
      await create(true);

      expect(component.availablePackages.map((p) => p.identifier)).toEqual(['donation_small', 'donation_large']);
      expect(component.isLoading).toBe(false);
    });

    it('actualiza precio y etiqueta de las opciones que RevenueCat conoce y deja las demás', async () => {
      await create(true);

      const byId = Object.fromEntries(component.donationOptions.map((o) => [o.id, o]));
      expect(byId['donation_small']).toMatchObject({ label: '$1.99 USD', amount: 1.99 });
      expect(byId['donation_large']).toMatchObject({ label: '$7.99 USD', amount: 7.99 });
      expect(byId['donation_medium']).toMatchObject({ label: '$5', amount: 5 }); // sin paquete: intacta
    });

    it('sin oferta vigente conserva las opciones por defecto', async () => {
      revenueCat.getOfferings.mockResolvedValue({ current: null });

      await create(true);

      expect(component.availablePackages).toEqual([]);
      expect(component.donationOptions[0].label).toBe('$2');
      expect(component.isLoading).toBe(false);
    });

    it('si RevenueCat falla avisa con un toast de error y deja de cargar', async () => {
      revenueCat.getOfferings.mockRejectedValue(new Error('sin red'));

      await create(true);

      expect(toastCalls()).toEqual([expect.objectContaining({ message: 'DONATION.messages.loadFailed', color: 'danger' })]);
      expect(component.isLoading).toBe(false);
    });
  });

  describe('donar', () => {
    it('en la web solo avisa que no está disponible', async () => {
      await create(false);

      await component.processDonation(component.donationOptions[0]);

      expect(toastCalls()[0]).toMatchObject({ color: 'warning', message: 'DONATION.messages.mobileOnly' });
      expect(revenueCat.purchasePackage).not.toHaveBeenCalled();
    });

    it('si la opción no tiene paquete en RevenueCat avisa y no cobra', async () => {
      await create(true);
      const medium = component.donationOptions.find((o) => o.id === 'donation_medium')!;

      await component.processDonation(medium);

      expect(toastCalls()[0]).toMatchObject({ color: 'danger', message: 'DONATION.messages.optionUnavailable' });
      expect(revenueCat.purchasePackage).not.toHaveBeenCalled();
      expect(loadingController.create).not.toHaveBeenCalled();
    });

    it('una compra exitosa cobra el paquete, agradece y cierra el modal tras una pausa', async () => {
      jest.useFakeTimers();
      await create(true);
      const small = component.donationOptions.find((o) => o.id === 'donation_small')!;

      await component.processDonation(small);

      expect(loading.present).toHaveBeenCalledTimes(1);
      expect(revenueCat.purchasePackage).toHaveBeenCalledWith(component.availablePackages[0]);
      expect(loading.dismiss).toHaveBeenCalledTimes(1);
      expect(toastCalls()[0]).toMatchObject({ color: 'success', message: 'DONATION.messages.thanks' });
      expect(modal.dismiss).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1500);
      expect(modal.dismiss).toHaveBeenCalledTimes(1);
    });

    it('si la compra no devuelve información del cliente no agradece ni cierra', async () => {
      jest.useFakeTimers();
      revenueCat.purchasePackage.mockResolvedValue({});
      await create(true);

      await component.processDonation(component.donationOptions[0]);
      jest.advanceTimersByTime(5000);

      expect(toastController.create).not.toHaveBeenCalled();
      expect(modal.dismiss).not.toHaveBeenCalled();
    });

    describe('errores de la compra', () => {
      beforeEach(() => create(true));

      const failWith = async (error: unknown) => {
        revenueCat.purchasePackage.mockRejectedValue(error);
        await component.processDonation(component.donationOptions[0]);
      };

      it('si la persona cancela no se muestra nada', async () => {
        await failWith(new PurchasesError(PURCHASES_ERROR_CODE.PURCHASE_CANCELLED, 'cancelada'));

        expect(toastController.create).not.toHaveBeenCalled();
        expect(loading.dismiss).toHaveBeenCalledTimes(1);
      });

      it.each([
        [PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED, 'warning', 'DONATION.messages.purchasesNotAllowed'],
        [PURCHASES_ERROR_CODE.NETWORK_ERROR, 'danger', 'DONATION.messages.networkError'],
        [PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE, 'warning', 'DONATION.messages.notAvailableNow'],
      ])('con %s avisa con el mensaje adecuado', async (code, color, message) => {
        await failWith(new PurchasesError(code, 'x'));

        expect(toastCalls()).toEqual([expect.objectContaining({ color, message })]);
        expect(loading.dismiss).toHaveBeenCalledTimes(1);
      });

      it('otro código de RevenueCat muestra su propio mensaje', async () => {
        await failWith(new PurchasesError(PURCHASES_ERROR_CODE.STORE_PROBLEM, 'la tienda falló'));

        expect(toastCalls()).toEqual([expect.objectContaining({ color: 'danger', message: 'DONATION.messages.errorWith' })]);
      });

      it('un error que no es de RevenueCat da un aviso genérico', async () => {
        await failWith(new Error('boom'));

        expect(toastCalls()).toEqual([expect.objectContaining({ color: 'danger', message: 'DONATION.messages.processFailed' })]);
        expect(loading.dismiss).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('restaurar compras', () => {
    it('en la web solo avisa que no está disponible', async () => {
      await create(false);

      await component.restorePurchases();

      expect(toastCalls()[0]).toMatchObject({ color: 'warning' });
      expect(revenueCat.restorePurchases).not.toHaveBeenCalled();
    });

    it('en nativo restaura y avisa del éxito, cerrando el cargando', async () => {
      await create(true);

      await component.restorePurchases();

      expect(revenueCat.restorePurchases).toHaveBeenCalledTimes(1);
      expect(loading.dismiss).toHaveBeenCalledTimes(1);
      expect(toastCalls()).toEqual([expect.objectContaining({ color: 'success', message: 'DONATION.messages.restored' })]);
    });

    it('si falla avisa del error y cierra el cargando', async () => {
      revenueCat.restorePurchases.mockRejectedValue(new Error('sin red'));
      await create(true);

      await component.restorePurchases();

      expect(loading.dismiss).toHaveBeenCalledTimes(1);
      expect(toastCalls()).toEqual([expect.objectContaining({ color: 'danger', message: 'DONATION.messages.restoreFailed' })]);
    });
  });

  it('dismiss cierra el modal de Ionic', async () => {
    await create(false);

    component.dismiss();

    expect(modal.dismiss).toHaveBeenCalledTimes(1);
  });
});
